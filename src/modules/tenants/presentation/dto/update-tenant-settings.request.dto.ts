import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';

export class UpdateTenantSettingsRequestDto {
  @ApiProperty({
    description: 'Moneda principal de operación del banco o cooperativa',
    enum: Currency,
    example: Currency.COP,
  })
  @IsEnum(Currency, {
    message: 'La moneda principal debe ser una de las admitidas: COP, USD, EUR',
  })
  @IsNotEmpty({ message: 'La moneda principal es obligatoria' })
  primaryCurrency: Currency;

  @ApiProperty({
    description:
      'Monto máximo permitido por transacción (estrictamente mayor a 0)',
    example: '50000000.00',
  })
  @IsString({ message: 'El monto máximo debe enviarse como cadena numérica' })
  @IsNotEmpty({ message: 'El límite máximo por transacción es obligatorio' })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'El monto máximo debe ser un número decimal válido con hasta 2 decimales',
  })
  maxTransactionAmount: string;

  @ApiProperty({
    description: 'Tipo de comisión aplicada a transferencias salientes',
    enum: FeeType,
    example: FeeType.FIXED,
  })
  @IsEnum(FeeType, {
    message: 'El tipo de comisión debe ser FIXED o PERCENTAGE',
  })
  @IsNotEmpty({ message: 'El tipo de comisión es obligatorio' })
  feeType: FeeType;

  @ApiProperty({
    description:
      'Valor de la comisión. Si es FIXED es monto fijo no negativo; si es PERCENTAGE debe estar entre 0 y 100',
    example: '2500.00',
  })
  @IsString({
    message: 'El valor de la comisión debe enviarse como cadena numérica',
  })
  @IsNotEmpty({ message: 'El valor de la comisión es obligatorio' })
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message:
      'El valor de la comisión debe ser un número decimal válido con hasta 4 decimales',
  })
  feeValue: string;
}

