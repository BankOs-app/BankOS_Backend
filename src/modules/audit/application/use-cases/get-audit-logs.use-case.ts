import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { AUDIT_LOG_REPOSITORY } from '../ports/audit-log.repository.port';
import type { AuditLogRepository } from '../ports/audit-log.repository.port';
import { AuditAction } from '../../domain/value-objects/audit-action.enum';
import {
  AuditLogItemDto,
  PaginatedAuditLogsResponseDto,
} from '../dto/audit-log-response.dto';

export interface GetAuditLogsInput {
  tenantSlug: string;
  action?: AuditAction;
  resource?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

/**
 * Caso de Uso: Consultar Auditoría Administrativa por Tenant (HU-14 - CA-HU-14-04).
 *
 * Garantiza aislamiento estricto: un administrador únicamente puede visualizar
 * los registros correspondientes al tenant sobre el cual tiene permisos.
 */
@Injectable()
export class GetAuditLogsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditRepository: AuditLogRepository,
  ) {}

  async execute(input: GetAuditLogsInput): Promise<PaginatedAuditLogsResponseDto> {
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    const paginated = await this.auditRepository.findPaginated({
      tenantId: tenant.getId(),
      action: input.action,
      resource: input.resource,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      page: input.page,
      limit: input.limit,
    });

    const items: AuditLogItemDto[] = paginated.data.map((log) => ({
      id: log.getId(),
      actorId: log.getActorId(),
      action: log.getAction(),
      resource: log.getResource(),
      resourceId: log.getResourceId(),
      previousValues: log.getPreviousValues(),
      newValues: log.getNewValues(),
      correlationId: log.getCorrelationId(),
      createdAt: log.getCreatedAt().toISOString(),
    }));

    const totalPages = Math.ceil(paginated.total / paginated.limit);

    return {
      data: items,
      total: paginated.total,
      page: paginated.page,
      limit: paginated.limit,
      totalPages: totalPages === 0 && paginated.total === 0 ? 0 : Math.max(totalPages, 1),
    };
  }
}

