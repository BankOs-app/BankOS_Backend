import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditAction } from '../../domain/value-objects/audit-action.enum';
import type {
  AuditLogRepository,
  AuditLogQueryFilter,
  PaginatedAuditResult,
} from '../../application/ports/audit-log.repository.port';

@Injectable()
export class DrizzleAuditLogRepository implements AuditLogRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async save(auditLog: AuditLog): Promise<void> {
    const info = await this.schemaResolver.resolve(auditLog.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.auditLogsTable).values({
      id: auditLog.getId(),
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
    const info = await this.schemaResolver.resolve(filter.tenantId);
    const tables = getTenantTables(info.schemaName);

    const conditions: any[] = [];

    if (filter.action) {
      conditions.push(eq(tables.auditLogsTable.action, filter.action));
    }

    if (filter.resource) {
      conditions.push(eq(tables.auditLogsTable.resource, filter.resource));
    }

    if (filter.startDate) {
      conditions.push(gte(tables.auditLogsTable.createdAt, filter.startDate));
    }

    if (filter.endDate) {
      conditions.push(lte(tables.auditLogsTable.createdAt, filter.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = this.db
      .select({ count: count() })
      .from(tables.auditLogsTable);
    const countResult = whereClause
      ? await countQuery.where(whereClause)
      : await countQuery;
    const total = Number(countResult[0]?.count ?? 0);

    const offset = (filter.page - 1) * filter.limit;

    let rowsQuery = this.db.select().from(tables.auditLogsTable);

    if (whereClause) {
      rowsQuery = rowsQuery.where(whereClause) as any;
    }

    const rows = await rowsQuery
      .orderBy(desc(tables.auditLogsTable.createdAt), desc(tables.auditLogsTable.id))
      .limit(filter.limit)
      .offset(offset);

    return {
      data: rows.map((r) => this.mapToDomain(r, info.tenantId)),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  private mapToDomain(row: any, tenantId: string): AuditLog {
    return AuditLog.reconstitute({
      id: row.id,
      tenantId,
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
