import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { WebhookEndpoint } from '../../domain/entities/webhook-endpoint.entity';
import type { WebhookEndpointRepository } from '../../application/ports/webhook-endpoint.repository.port';

@Injectable()
export class DrizzleWebhookEndpointRepository
  implements WebhookEndpointRepository
{
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async save(endpoint: WebhookEndpoint): Promise<void> {
    const info = await this.schemaResolver.resolve(endpoint.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.webhookEndpointsTable).values({
      id: endpoint.getId(),
      url: endpoint.getUrl(),
      secret: endpoint.getSecret(),
      events: endpoint.getEvents(),
      isActive: endpoint.getIsActive(),
      createdAt: endpoint.getCreatedAt(),
    });
  }

  async findById(id: string, tenantId?: string): Promise<WebhookEndpoint | null> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.webhookEndpointsTable)
        .where(eq(tables.webhookEndpointsTable.id, id))
        .limit(1);

      if (rows.length === 0) return null;
      return this.mapToDomain(rows[0], info.tenantId);
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.webhookEndpointsTable)
        .where(eq(tables.webhookEndpointsTable.id, id))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }
    return null;
  }

  async findByTenantId(tenantId: string): Promise<WebhookEndpoint[]> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db.select().from(tables.webhookEndpointsTable);
    return rows.map((r) => this.mapToDomain(r, info.tenantId));
  }

  async findByTenantAndEvent(
    tenantId: string,
    eventType: string,
  ): Promise<WebhookEndpoint[]> {
    const endpoints = await this.findByTenantId(tenantId);
    return endpoints.filter((ep) => ep.isSubscribedTo(eventType));
  }

  private mapToDomain(row: any, tenantId: string): WebhookEndpoint {
    return WebhookEndpoint.reconstitute({
      id: row.id,
      tenantId,
      url: row.url,
      secret: row.secret,
      events: (row.events as string[]) ?? [],
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  }
}
