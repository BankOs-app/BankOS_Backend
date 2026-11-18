import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';

/**
 * DTO para la petición HTTP de creación de un Tenant con configuración inicial (HU-01 / HU-02).
 */
export class CreateTenantRequestDto {
  @ApiProperty({
    description: 'Nombre comercial o razón social de la institución financiera',
    example: 'Banco de Bogotá',
    minLength: 3,
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la institución es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder los 100 caracteres' })
  name: string;

  @ApiProperty({
    description:
      'Identificador único (slug) para el tenant, usado en URLs y nombres de esquema',
    example: 'banco-bogota',
    minLength: 3,
    maxLength: 50,
  })
  @IsString({ message: 'El slug debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El slug es obligatorio' })
  @MinLength(3, { message: 'El slug debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El slug no puede exceder los 50 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'El slug solo permite caracteres alfanuméricos en minúscula separados por guiones simples',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Moneda principal de operación del banco (COP, USD, EUR)',
    enum: Currency,
    default: Currency.COP,
    example: 'COP',
  })
  @IsOptional()
  @IsEnum(Currency, { message: 'La moneda principal debe ser COP, USD o EUR' })
  primaryCurrency?: Currency;

  @ApiPropertyOptional({
    description: 'Límite máximo permitido por transacción',
    example: '50000000.00',
    default: '50000000.00',
  })
  @IsOptional()
  @IsNumberString({}, { message: 'El monto máximo debe ser un valor numérico decimal' })
  maxTransactionAmount?: string;

  @ApiPropertyOptional({
    description: 'Tipo de comisión en transferencias salientes: FIXED o PERCENTAGE',
    enum: FeeType,
    default: FeeType.FIXED,
    example: 'FIXED',
  })
  @IsOptional()
  @IsEnum(FeeType, { message: 'El tipo de comisión debe ser FIXED o PERCENTAGE' })
  feeType?: FeeType;

  @ApiPropertyOptional({
    description: 'Valor de la comisión (monto fijo o porcentaje entre 0 y 100)',
    example: '2500.00',
    default: '0.00',
  })
  @IsOptional()
  @IsNumberString({}, { message: 'El valor de la comisión debe ser numérico decimal' })
  feeValue?: string;
}
