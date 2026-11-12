import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditAction } from '../../domain/value-objects/audit-action.enum';

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export interface AuditLogQueryFilter {
  tenantId: string;
  action?: AuditAction;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

export interface PaginatedAuditResult {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Puerto de Persistencia de Auditoría.
 * Solo contiene métodos de lectura y guardado (Append-only).
 * No expone métodos de modificación ni eliminación (CA-HU-14-03).
 */
export interface AuditLogRepository {
  save(auditLog: AuditLog): Promise<void>;
  findPaginated(filter: AuditLogQueryFilter): Promise<PaginatedAuditResult>;
}

