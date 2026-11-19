import { Inject, Injectable } from '@nestjs/common';
import { and, eq, lte, or, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { OutboxEvent, OutboxStatus } from '../../domain/entities/outbox-event.entity';
import type { OutboxRepository } from '../../application/ports/outbox.repository.port';

@Injectable()
export class DrizzleOutboxRepository implements OutboxRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async save(event: OutboxEvent): Promise<void> {
    const info = await this.schemaResolver.resolve(event.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.outboxEventsTable).values({
      id: event.getId(),
      eventType: event.getEventType(),
      payload: event.getPayload(),
      status: event.getStatus(),
      attempts: event.getAttempts(),
      maxAttempts: event.getMaxAttempts(),
      nextRetryAt: event.getNextRetryAt() ?? null,
      lastError: event.getLastError() ?? null,
      createdAt: event.getCreatedAt(),
      updatedAt: event.getUpdatedAt(),
    });
  }

  async update(event: OutboxEvent): Promise<void> {
    const info = await this.schemaResolver.resolve(event.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db
      .update(tables.outboxEventsTable)
      .set({
        status: event.getStatus(),
        attempts: event.getAttempts(),
        nextRetryAt: event.getNextRetryAt() ?? null,
        lastError: event.getLastError() ?? null,
        updatedAt: event.getUpdatedAt(),
      })
      .where(eq(tables.outboxEventsTable.id, event.getId()));
  }

  async findById(id: string, tenantId?: string): Promise<OutboxEvent | null> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.outboxEventsTable)
        .where(eq(tables.outboxEventsTable.id, id))
        .limit(1);

      if (rows.length === 0) return null;
      return this.mapToDomain(rows[0], info.tenantId);
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.outboxEventsTable)
        .where(eq(tables.outboxEventsTable.id, id))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }
    return null;
  }

  async findPendingEvents(limit: number = 20, tenantId?: string): Promise<OutboxEvent[]> {
    const now = new Date();

    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.outboxEventsTable)
        .where(
          and(
            eq(tables.outboxEventsTable.status, OutboxStatus.PENDING),
            or(
              isNull(tables.outboxEventsTable.nextRetryAt),
              lte(tables.outboxEventsTable.nextRetryAt, now),
            ),
          ),
        )
        .limit(limit);

      return rows.map((r) => this.mapToDomain(r, info.tenantId));
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    const result: OutboxEvent[] = [];

    for (const schema of schemas) {
      if (result.length >= limit) break;
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.outboxEventsTable)
        .where(
          and(
            eq(tables.outboxEventsTable.status, OutboxStatus.PENDING),
            or(
              isNull(tables.outboxEventsTable.nextRetryAt),
              lte(tables.outboxEventsTable.nextRetryAt, now),
            ),
          ),
        )
        .limit(limit - result.length);

      for (const r of rows) {
        result.push(this.mapToDomain(r, schema.tenantId));
      }
    }

    return result;
  }

  async findByTenantId(tenantId: string): Promise<OutboxEvent[]> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db.select().from(tables.outboxEventsTable);
    return rows.map((r) => this.mapToDomain(r, info.tenantId));
  }

  private mapToDomain(row: any, tenantId: string): OutboxEvent {
    return OutboxEvent.reconstitute({
      id: row.id,
      tenantId,
      eventType: row.eventType,
      payload: row.payload as Record<string, unknown>,
      status: row.status as OutboxStatus,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      nextRetryAt: row.nextRetryAt,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
