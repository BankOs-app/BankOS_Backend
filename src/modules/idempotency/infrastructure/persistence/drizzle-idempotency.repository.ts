import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import {
  idempotencyRecordsTable,
  IdempotencyRecordDb,
} from '../../../../database/schema/idempotency.schema';
import { IdempotencyRecord } from '../../domain/entities/idempotency-record.entity';
import { IdempotencyStatus } from '../../domain/value-objects/idempotency-status.enum';
import type { IdempotencyRepository } from '../../application/ports/idempotency.repository.port';

@Injectable()
export class DrizzleIdempotencyRepository
  implements IdempotencyRepository, OnModuleInit
{
  private readonly logger = new Logger(DrizzleIdempotencyRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.idempotency_records (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          user_id VARCHAR(100) NOT NULL,
          idempotency_key VARCHAR(100) NOT NULL,
          request_hash VARCHAR(64) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
          response_status INTEGER,
          response_body TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          CONSTRAINT idempotency_tenant_user_key_unique UNIQUE(tenant_id, user_id, idempotency_key)
        );
      `);
      this.logger.log('Tabla public.idempotency_records verificada o inicializada.');
    } catch {
      this.logger.warn(
        'No se pudo verificar la tabla public.idempotency_records en el arranque.',
      );
    }
  }

  async findByKey(
    tenantId: string,
    userId: string,
    key: string,
  ): Promise<IdempotencyRecord | null> {
    const rows = await this.db
      .select()
      .from(idempotencyRecordsTable)
      .where(
        and(
          eq(idempotencyRecordsTable.tenantId, tenantId),
          eq(idempotencyRecordsTable.userId, userId),
          eq(idempotencyRecordsTable.key, key.trim()),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async save(record: IdempotencyRecord): Promise<void> {
    await this.db.insert(idempotencyRecordsTable).values({
      id: record.getId(),
      tenantId: record.getTenantId(),
      userId: record.getUserId(),
      key: record.getKey(),
      requestHash: record.getRequestHash(),
      status: record.getStatus(),
      responseStatus: record.getResponseStatus(),
      responseBody: record.getResponseBody(),
      createdAt: record.getCreatedAt(),
      expiresAt: record.getExpiresAt(),
    });
  }

  async update(record: IdempotencyRecord): Promise<void> {
    await this.db
      .update(idempotencyRecordsTable)
      .set({
        status: record.getStatus(),
        responseStatus: record.getResponseStatus(),
        responseBody: record.getResponseBody(),
      })
      .where(eq(idempotencyRecordsTable.id, record.getId()));
  }

  private mapToDomain(row: IdempotencyRecordDb): IdempotencyRecord {
    return IdempotencyRecord.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      key: row.key,
      requestHash: row.requestHash,
      status: row.status as IdempotencyStatus,
      responseStatus: row.responseStatus ?? undefined,
      responseBody: row.responseBody ?? undefined,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    });
  }
}

