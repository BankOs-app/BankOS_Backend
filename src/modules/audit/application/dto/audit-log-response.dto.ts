import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../../domain/value-objects/audit-action.enum';

export class AuditLogItemDto {
  @ApiProperty({ description: 'ID del registro de auditoría', example: 'e718c321-2e63-4a62-97b5-2ea6572e5cc1' })
  id: string;

  @ApiProperty({ description: 'ID del actor (administrador) que realizó la acción', example: 'user-admin-1' })
  actorId: string;

  @ApiProperty({ description: 'Acción administrativa realizada', enum: AuditAction, example: AuditAction.UPDATE_SETTINGS })
  action: AuditAction;

  @ApiProperty({ description: 'Tipo de recurso modificado', example: 'tenant_settings' })
  resource: string;

  @ApiProperty({ description: 'Identificador del recurso modificado', example: 'tenant-uuid-1' })
  resourceId: string;

  @ApiProperty({ description: 'Valores anteriores antes de la modificación', required: false, example: { feeValue: '1000.00' } })
  previousValues?: Record<string, unknown> | null;

  @ApiProperty({ description: 'Nuevos valores persistidos tras la modificación', required: false, example: { feeValue: '2500.00' } })
  newValues?: Record<string, unknown> | null;

  @ApiProperty({ description: 'Correlation ID de trazabilidad', required: false, example: 'b5a03e6f-7b0b-4e1a-8c9e-5e7b2b8c9e5e' })
  correlationId?: string | null;

  @ApiProperty({ description: 'Fecha y hora UTC del evento', example: '2026-11-12T15:00:00.000Z' })
  createdAt: string;
}

export class PaginatedAuditLogsResponseDto {
  @ApiProperty({ type: [AuditLogItemDto], description: 'Registros de auditoría obtenidos' })
  data: AuditLogItemDto[];

  @ApiProperty({ description: 'Total de eventos de auditoría encontrados', example: 15 })
  total: number;

  @ApiProperty({ description: 'Página actual consultada', example: 1 })
  page: number;

  @ApiProperty({ description: 'Límite de registros por página', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total de páginas disponibles', example: 2 })
  totalPages: number;
}

