import { Inject, Injectable, Logger } from '@nestjs/common';
import { AUDIT_LOG_REPOSITORY } from '../ports/audit-log.repository.port';
import type { AuditLogRepository } from '../ports/audit-log.repository.port';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { AuditAction } from '../../domain/value-objects/audit-action.enum';

export interface RecordAuditLogInput {
  tenantId: string;
  actorId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  correlationId?: string | null;
}

/**
 * Caso de Uso: Registrar Acción Administrativa en Auditoría (HU-14 - CA-HU-14-01).
 *
 * Registra un evento inmutable sin persistir contraseñas, tokens ni credenciales sensibles.
 */
@Injectable()
export class RecordAuditLogUseCase {
  private readonly logger = new Logger(RecordAuditLogUseCase.name);

  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditRepository: AuditLogRepository,
  ) {}

  async execute(input: RecordAuditLogInput): Promise<AuditLog> {
    // Sanitizar posibles campos sensibles de los valores guardados
    const sanitizedPrevious = this.sanitize(input.previousValues);
    const sanitizedNew = this.sanitize(input.newValues);

    const auditLog = AuditLog.create({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      previousValues: sanitizedPrevious,
      newValues: sanitizedNew,
      correlationId: input.correlationId,
    });

    await this.auditRepository.save(auditLog);
    this.logger.log(
      `Acción auditada: [${input.action}] sobre [${input.resource}:${input.resourceId}] por [${input.actorId}] en tenant [${input.tenantId}].`,
    );

    return auditLog;
  }

  private sanitize(
    data?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!data) return null;
    const sensitiveKeys = ['password', 'token', 'secret', 'pin', 'authorization'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

