import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { AuditAction } from '../../domain/value-objects/audit-action.enum';

export class AuditQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por acción específica',
    enum: AuditAction,
  })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({
    description: 'Filtrar por recurso auditado (ej. tenant_settings, accounts, users)',
  })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicial para filtrar (formato ISO 8601, ej. 2026-01-01T00:00:00Z)',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final para filtrar (formato ISO 8601, ej. 2026-12-31T23:59:59Z)',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Número de página a consultar (comenzando en 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de elementos por página (entre 1 y 100)',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

