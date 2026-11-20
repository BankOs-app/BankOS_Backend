import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';

/**
 * DTO para la petición HTTP de creación de un Tenant con configuración financiera completa (HU-01 / HU-02).
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

  @ApiPropertyOptional({ description: 'Código comercial único de la entidad', example: 'NOVAPAY' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/, {
    message: 'El código solo admite letras, números, guiones y guiones bajos',
  })
  code?: string;

  @ApiPropertyOptional({ description: 'Subdominio asignado bajo bankos.io', example: 'novapay.bankos.io' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.bankos\.io$/, {
    message: 'El subdominio debe tener el formato nombre.bankos.io en minúsculas',
  })
  subdomain?: string;

  @ApiProperty({
    description:
      'Identificador único (slug) para el tenant, usado en URLs y nombres de esquema físico',
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

  @ApiProperty({
    description: 'Moneda principal de operación del banco (COP, USD, EUR)',
    enum: Currency,
    example: Currency.COP,
  })
  @IsNotEmpty({ message: 'La moneda principal es obligatoria (COP, USD o EUR)' })
  @IsEnum(Currency, { message: 'La moneda principal debe ser COP, USD o EUR' })
  primaryCurrency: Currency;

  @ApiProperty({
    description: 'Límite máximo permitido por transacción en la moneda principal',
    example: '50000000.00',
  })
  @IsNotEmpty({ message: 'El límite máximo por transacción es obligatorio' })
  @IsNumberString({}, { message: 'El monto máximo debe ser un valor numérico decimal' })
  maxTransactionAmount: string;

  @ApiProperty({
    description: 'Tipo de comisión en transferencias salientes: FIXED (fija) o VARIABLE (variable/porcentual)',
    enum: FeeType,
    example: FeeType.FIXED,
  })
  @IsNotEmpty({ message: 'El tipo de comisión es obligatorio (FIXED o VARIABLE)' })
  @IsEnum(FeeType, { message: 'El tipo de comisión debe ser FIXED o VARIABLE' })
  feeType: FeeType;

  @ApiProperty({
    description: 'Valor de la comisión aplicada (ej. 2500.00 para FIXED o 1.50 para VARIABLE)',
    example: '2500.00',
  })
  @IsNotEmpty({ message: 'El valor de la comisión es obligatorio' })
  @IsNumberString({}, { message: 'El valor de la comisión debe ser numérico decimal' })
  feeValue: string;
}
