import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import {
  webhookEndpointsTable,
  WebhookEndpointRecord,
} from '../../../../database/schema/webhooks-outbox.schema';
import { WebhookEndpoint } from '../../domain/entities/webhook-endpoint.entity';
import type { WebhookEndpointRepository } from '../../application/ports/webhook-endpoint.repository.port';

@Injectable()
export class DrizzleWebhookEndpointRepository
  implements WebhookEndpointRepository, OnModuleInit
{
  private readonly logger = new Logger(DrizzleWebhookEndpointRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          url VARCHAR(500) NOT NULL,
          secret VARCHAR(200) NOT NULL,
          events JSONB NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      this.logger.log('Tabla public.webhook_endpoints verificada.');
    } catch {
      this.logger.warn('No se pudo verificar la tabla public.webhook_endpoints en el arranque.');
    }
  }

  async save(endpoint: WebhookEndpoint): Promise<void> {
    await this.db.insert(webhookEndpointsTable).values({
      id: endpoint.getId(),
      tenantId: endpoint.getTenantId(),
      url: endpoint.getUrl(),
      secret: endpoint.getSecret(),
      events: endpoint.getEvents(),
      isActive: endpoint.getIsActive(),
      createdAt: endpoint.getCreatedAt(),
    });
  }

  async findById(id: string): Promise<WebhookEndpoint | null> {
    const rows = await this.db
      .select()
      .from(webhookEndpointsTable)
      .where(eq(webhookEndpointsTable.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByTenantId(tenantId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.db
      .select()
      .from(webhookEndpointsTable)
      .where(eq(webhookEndpointsTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }

  async findByTenantAndEvent(
    tenantId: string,
    eventType: string,
  ): Promise<WebhookEndpoint[]> {
    const endpoints = await this.findByTenantId(tenantId);
    return endpoints.filter((ep) => ep.isSubscribedTo(eventType));
  }

  private mapToDomain(row: WebhookEndpointRecord): WebhookEndpoint {
    return WebhookEndpoint.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      url: row.url,
      secret: row.secret,
      events: (row.events as string[]) ?? [],
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  }
}

