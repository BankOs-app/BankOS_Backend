import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { WEBHOOK_ENDPOINT_REPOSITORY } from '../ports/webhook-endpoint.repository.port';
import type { WebhookEndpointRepository } from '../ports/webhook-endpoint.repository.port';
import { WebhookEndpoint } from '../../domain/entities/webhook-endpoint.entity';

export interface RegisterWebhookInput {
  tenantSlug: string;
  url: string;
  events: string[];
}

export interface RegisterWebhookOutput {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

/**
 * Caso de Uso: Registrar Endpoint de Webhook (HU-15 - T03).
 *
 * Incluye validación de formato URL y protección contra ataques SSRF (Server-Side Request Forgery).
 */
@Injectable()
export class RegisterWebhookUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(WEBHOOK_ENDPOINT_REPOSITORY)
    private readonly webhookRepository: WebhookEndpointRepository,
  ) {}

  async execute(input: RegisterWebhookInput): Promise<RegisterWebhookOutput> {
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    this.validateUrl(input.url);

    if (!input.events || input.events.length === 0) {
      throw new BadRequestException('Debe suscribirse al menos a un evento (ej. transfer.completed).');
    }

    const endpoint = WebhookEndpoint.create({
      tenantId: tenant.getId(),
      url: input.url,
      events: input.events,
    });

    await this.webhookRepository.save(endpoint);

    return {
      id: endpoint.getId(),
      tenantId: endpoint.getTenantId(),
      url: endpoint.getUrl(),
      secret: endpoint.getSecret(),
      events: endpoint.getEvents(),
      isActive: endpoint.getIsActive(),
      createdAt: endpoint.getCreatedAt().toISOString(),
    };
  }

  private validateUrl(urlStr: string): void {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new BadRequestException(`URL de webhook inválida: '${urlStr}'`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('El webhook solo soporta protocolos HTTP o HTTPS.');
    }

    const hostname = parsed.hostname.toLowerCase();
    // Protección SSRF básica para destinos peligrosos de metadata de nubes
    if (
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      throw new BadRequestException('Destino de webhook bloqueado por políticas de seguridad SSRF.');
    }
  }
}

