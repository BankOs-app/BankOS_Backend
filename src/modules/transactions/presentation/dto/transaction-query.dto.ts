import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { TransactionType } from '../../domain/value-objects/transaction-types.enum';

export class TransactionQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo de operación (DEPOSIT, WITHDRAWAL, TRANSFER)',
    enum: TransactionType,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Fecha inicial para filtrar movimientos (ISO 8601, ej. 2026-01-01T00:00:00.000Z)',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final para filtrar movimientos (ISO 8601, ej. 2026-12-31T23:59:59.999Z)',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por número de cuenta específico',
    example: '1001234567',
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

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

