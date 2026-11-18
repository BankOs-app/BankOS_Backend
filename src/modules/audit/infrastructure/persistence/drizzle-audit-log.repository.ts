import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import {
  auditLogsTable,
  AuditLogRecord,
} from '../../../../database/schema/audit-logs.schema';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditAction } from '../../domain/value-objects/audit-action.enum';
import type {
  AuditLogRepository,
  AuditLogQueryFilter,
  PaginatedAuditResult,
} from '../../application/ports/audit-log.repository.port';

@Injectable()
export class DrizzleAuditLogRepository
  implements AuditLogRepository, OnModuleInit
{
  private readonly logger = new Logger(DrizzleAuditLogRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.audit_logs (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          actor_id VARCHAR(100) NOT NULL,
          action VARCHAR(50) NOT NULL,
          resource VARCHAR(50) NOT NULL,
          resource_id VARCHAR(100) NOT NULL,
          previous_values JSONB,
          new_values JSONB,
          correlation_id VARCHAR(100),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Inmutabilidad estricta (CA-HU-14-03): Impedir UPDATE y DELETE a nivel de base de datos
        CREATE OR REPLACE RULE audit_logs_no_update AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;
        CREATE OR REPLACE RULE audit_logs_no_delete AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;
      `);
      this.logger.log('Tabla public.audit_logs y reglas de inmutabilidad verificadas.');
    } catch {
      this.logger.warn('No se pudo verificar la tabla public.audit_logs en el arranque.');
    }
  }

  async save(auditLog: AuditLog): Promise<void> {
    await this.db.insert(auditLogsTable).values({
      id: auditLog.getId(),
      tenantId: auditLog.getTenantId(),
      actorId: auditLog.getActorId(),
      action: auditLog.getAction(),
      resource: auditLog.getResource(),
      resourceId: auditLog.getResourceId(),
      previousValues: auditLog.getPreviousValues() ?? null,
      newValues: auditLog.getNewValues() ?? null,
      correlationId: auditLog.getCorrelationId() ?? null,
      createdAt: auditLog.getCreatedAt(),
    });
  }

  async findPaginated(filter: AuditLogQueryFilter): Promise<PaginatedAuditResult> {
    const conditions = [eq(auditLogsTable.tenantId, filter.tenantId)];

    if (filter.action) {
      conditions.push(eq(auditLogsTable.action, filter.action));
    }

    if (filter.resource) {
      conditions.push(eq(auditLogsTable.resource, filter.resource));
    }

    if (filter.startDate) {
      conditions.push(gte(auditLogsTable.createdAt, filter.startDate));
    }

    if (filter.endDate) {
      conditions.push(lte(auditLogsTable.createdAt, filter.endDate));
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(auditLogsTable)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    const offset = (filter.page - 1) * filter.limit;

    const rows = await this.db
      .select()
      .from(auditLogsTable)
      .where(whereClause)
      .orderBy(desc(auditLogsTable.createdAt), desc(auditLogsTable.id))
      .limit(filter.limit)
      .offset(offset);

    return {
      data: rows.map((r) => this.mapToDomain(r)),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  private mapToDomain(row: AuditLogRecord): AuditLog {
    return AuditLog.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      actorId: row.actorId,
      action: row.action as AuditAction,
      resource: row.resource,
      resourceId: row.resourceId,
      previousValues: (row.previousValues as Record<string, unknown>) ?? null,
      newValues: (row.newValues as Record<string, unknown>) ?? null,
      correlationId: row.correlationId ?? null,
      createdAt: row.createdAt,
    });
  }
}

