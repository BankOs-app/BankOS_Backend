import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { IdempotencyRecord } from '../../domain/entities/idempotency-record.entity';
import { IdempotencyStatus } from '../../domain/value-objects/idempotency-status.enum';
import type { IdempotencyRepository } from '../../application/ports/idempotency.repository.port';

@Injectable()
export class DrizzleIdempotencyRepository implements IdempotencyRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async findByKey(
    tenantId: string,
    userId: string,
    key: string,
  ): Promise<IdempotencyRecord | null> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db
      .select()
      .from(tables.idempotencyRecordsTable)
      .where(
        and(
          eq(tables.idempotencyRecordsTable.userId, userId),
          eq(tables.idempotencyRecordsTable.idempotencyKey, key.trim()),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0], info.tenantId);
  }

  async save(record: IdempotencyRecord): Promise<void> {
    const info = await this.schemaResolver.resolve(record.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.idempotencyRecordsTable).values({
      id: record.getId(),
      userId: record.getUserId(),
      idempotencyKey: record.getKey(),
      requestHash: record.getRequestHash(),
      status: record.getStatus(),
      responseCode: record.getResponseStatus() ?? null,
      responseBody: record.getResponseBody() ? JSON.parse(record.getResponseBody()!) : null,
      createdAt: record.getCreatedAt(),
      expiresAt: record.getExpiresAt(),
    });
  }

  async update(record: IdempotencyRecord): Promise<void> {
    const info = await this.schemaResolver.resolve(record.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db
      .update(tables.idempotencyRecordsTable)
      .set({
        status: record.getStatus(),
        responseCode: record.getResponseStatus() ?? null,
        responseBody: record.getResponseBody() ? JSON.parse(record.getResponseBody()!) : null,
      })
      .where(eq(tables.idempotencyRecordsTable.id, record.getId()));
  }

  private mapToDomain(row: any, tenantId: string): IdempotencyRecord {
    return IdempotencyRecord.reconstitute({
      id: row.id,
      tenantId,
      userId: row.userId,
      key: row.idempotencyKey,
      requestHash: row.requestHash,
      status: row.status as IdempotencyStatus,
      responseStatus: row.responseCode ?? undefined,
      responseBody: row.responseBody ? JSON.stringify(row.responseBody) : undefined,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    });
  }
}
