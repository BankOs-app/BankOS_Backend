import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { OUTBOX_REPOSITORY } from '../ports/outbox.repository.port';
import type { OutboxRepository } from '../ports/outbox.repository.port';
import { WEBHOOK_ENDPOINT_REPOSITORY } from '../ports/webhook-endpoint.repository.port';
import type { WebhookEndpointRepository } from '../ports/webhook-endpoint.repository.port';
import { OutboxEvent } from '../../domain/entities/outbox-event.entity';

export interface DispatchSummary {
  processed: number;
  delivered: number;
  failed: number;
}

/**
 * Servicio Despachador de Outbox y Webhooks (HU-15 - T05, T06).
 *
 * Lee eventos pendientes, calcula firma HMAC-SHA256 y envía petición HTTP POST
 * asíncrona a los endpoints suscritos. Si falla, programa reintentos exponenciales
 * sin alterar bajo ninguna circunstancia el estado financiero original (CA-HU-15-03).
 */
@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository: OutboxRepository,
    @Inject(WEBHOOK_ENDPOINT_REPOSITORY)
    private readonly webhookRepository: WebhookEndpointRepository,
  ) {}

  async dispatchPending(limit: number = 20): Promise<DispatchSummary> {
    const events = await this.outboxRepository.findPendingEvents(limit);
    let delivered = 0;
    let failed = 0;

    for (const event of events) {
      const success = await this.processSingleEvent(event);
      if (success) {
        delivered++;
      } else {
        failed++;
      }
    }

    return {
      processed: events.length,
      delivered,
      failed,
    };
  }

  async processSingleEvent(event: OutboxEvent): Promise<boolean> {
    const endpoints = await this.webhookRepository.findByTenantAndEvent(
      event.getTenantId(),
      event.getEventType(),
    );

    // Si ningún webhook está suscrito a este evento, se marca como entregado
    if (endpoints.length === 0) {
      event.markDelivered();
      await this.outboxRepository.update(event);
      return true;
    }

    let allDelivered = true;

    for (const endpoint of endpoints) {
      const payloadString = JSON.stringify({
        id: event.getId(),
        tenantId: event.getTenantId(),
        eventType: event.getEventType(),
        payload: event.getPayload(),
        createdAt: event.getCreatedAt().toISOString(),
      });

      const signature = createHmac('sha256', endpoint.getSecret())
        .update(payloadString)
        .digest('hex');

      let timeoutId: NodeJS.Timeout | undefined;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(endpoint.getUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-BankOS-Signature': `sha256=${signature}`,
            'X-BankOS-Event': event.getEventType(),
            'X-BankOS-Delivery': event.getId(),
          },
          body: payloadString,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
        }
      } catch (err: unknown) {
        allDelivered = false;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Fallo al entregar webhook '${endpoint.getUrl()}' para evento '${event.getId()}': ${msg}`,
        );
        event.recordAttemptFailure(msg);
        await this.outboxRepository.update(event);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    if (allDelivered) {
      event.markDelivered();
      await this.outboxRepository.update(event);
      return true;
    }

    return false;
  }
}
