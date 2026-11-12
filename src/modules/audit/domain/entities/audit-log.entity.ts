import { randomUUID } from 'node:crypto';
import { AuditAction } from '../value-objects/audit-action.enum';

export interface AuditLogProps {
  id: string;
  tenantId: string;
  actorId: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  correlationId?: string | null;
  createdAt: Date;
}

/**
 * Entidad de Dominio: Registro de Auditoría Inmutable (HU-14).
 *
 * Captura un evento administrativo con valores anterior/nuevo para fines
 * de cumplimiento regulatorio y trazabilidad. Es estrictamente de solo lectura (Append-only).
 */
export class AuditLog {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly actorId: string;
  private readonly action: AuditAction;
  private readonly resource: string;
  private readonly resourceId: string;
  private readonly previousValues?: Record<string, unknown> | null;
  private readonly newValues?: Record<string, unknown> | null;
  private readonly correlationId?: string | null;
  private readonly createdAt: Date;

  private constructor(props: AuditLogProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.actorId = props.actorId;
    this.action = props.action;
    this.resource = props.resource;
    this.resourceId = props.resourceId;
    this.previousValues = props.previousValues;
    this.newValues = props.newValues;
    this.correlationId = props.correlationId;
    this.createdAt = props.createdAt;
  }

  public static create(params: {
    tenantId: string;
    actorId: string;
    action: AuditAction;
    resource: string;
    resourceId: string;
    previousValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    correlationId?: string | null;
  }): AuditLog {
    if (!params.tenantId) throw new Error('El tenantId es obligatorio para la auditoría.');
    if (!params.actorId) throw new Error('El actorId es obligatorio para la auditoría.');
    if (!params.action) throw new Error('La acción es obligatoria para la auditoría.');
    if (!params.resource) throw new Error('El recurso es obligatorio para la auditoría.');

    return new AuditLog({
      id: randomUUID(),
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      previousValues: params.previousValues ?? null,
      newValues: params.newValues ?? null,
      correlationId: params.correlationId ?? null,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: AuditLogProps): AuditLog {
    return new AuditLog(props);
  }

  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getActorId(): string {
    return this.actorId;
  }

  public getAction(): AuditAction {
    return this.action;
  }

  public getResource(): string {
    return this.resource;
  }

  public getResourceId(): string {
    return this.resourceId;
  }

  public getPreviousValues(): Record<string, unknown> | null | undefined {
    return this.previousValues;
  }

  public getNewValues(): Record<string, unknown> | null | undefined {
    return this.newValues;
  }

  public getCorrelationId(): string | null | undefined {
    return this.correlationId;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}

