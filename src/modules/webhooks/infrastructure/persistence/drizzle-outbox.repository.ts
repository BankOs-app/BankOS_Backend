import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq, lte, or, isNull } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import {
  outboxEventsTable,
  OutboxEventRecord,
} from '../../../../database/schema/webhooks-outbox.schema';
import { OutboxEvent, OutboxStatus } from '../../domain/entities/outbox-event.entity';
import type { OutboxRepository } from '../../application/ports/outbox.repository.port';

@Injectable()
export class DrizzleOutboxRepository implements OutboxRepository, OnModuleInit {
  private readonly logger = new Logger(DrizzleOutboxRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.outbox_events (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          event_type VARCHAR(50) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          next_retry_at TIMESTAMPTZ,
          last_error VARCHAR(1000),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      this.logger.log('Tabla public.outbox_events verificada.');
    } catch {
      this.logger.warn('No se pudo verificar la tabla public.outbox_events en el arranque.');
    }
  }

  async save(event: OutboxEvent): Promise<void> {
    await this.db.insert(outboxEventsTable).values({
      id: event.getId(),
      tenantId: event.getTenantId(),
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
    await this.db
      .update(outboxEventsTable)
      .set({
        status: event.getStatus(),
        attempts: event.getAttempts(),
        nextRetryAt: event.getNextRetryAt() ?? null,
        lastError: event.getLastError() ?? null,
        updatedAt: event.getUpdatedAt(),
      })
      .where(eq(outboxEventsTable.id, event.getId()));
  }

  async findById(id: string): Promise<OutboxEvent | null> {
    const rows = await this.db
      .select()
      .from(outboxEventsTable)
      .where(eq(outboxEventsTable.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findPendingEvents(limit: number = 20): Promise<OutboxEvent[]> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(outboxEventsTable)
      .where(
        and(
          eq(outboxEventsTable.status, OutboxStatus.PENDING),
          or(
            isNull(outboxEventsTable.nextRetryAt),
            lte(outboxEventsTable.nextRetryAt, now),
          ),
        ),
      )
      .limit(limit);

    return rows.map((r) => this.mapToDomain(r));
  }

  async findByTenantId(tenantId: string): Promise<OutboxEvent[]> {
    const rows = await this.db
      .select()
      .from(outboxEventsTable)
      .where(eq(outboxEventsTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: OutboxEventRecord): OutboxEvent {
    return OutboxEvent.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
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

