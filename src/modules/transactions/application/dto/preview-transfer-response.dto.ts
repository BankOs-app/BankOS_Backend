import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import { FeeType } from '../../../tenants/domain/value-objects/fee-type.enum';

export class PreviewTransferResponseDto {
  @ApiProperty({
    description: 'Número de cuenta de origen',
    example: '1001234567',
  })
  sourceAccountNumber: string;

  @ApiProperty({
    description: 'Moneda de la cuenta de origen',
    enum: Currency,
    example: Currency.USD,
  })
  sourceCurrency: Currency;

  @ApiProperty({
    description: 'Número de cuenta destino',
    example: '2009876543',
  })
  destinationAccountNumber: string;

  @ApiProperty({
    description: 'Moneda de la cuenta de destino',
    enum: Currency,
    example: Currency.COP,
  })
  destinationCurrency: Currency;

  @ApiProperty({
    description: 'Monto final neto que recibirá el destino',
    example: '400000.00',
  })
  targetAmount: string;

  @ApiProperty({
    description: 'Monto equivalente a debitar en la moneda de origen antes de comisiones',
    example: '100.00',
  })
  sourceEquivalentAmount: string;

  @ApiProperty({
    description: 'Tasa de cambio estática aplicada para la conversión de divisas',
    example: '4000.000000',
  })
  exchangeRateApplied: string;

  @ApiProperty({
    description: 'Monto de la comisión calculada en moneda de origen',
    example: '2.00',
  })
  feeAmount: string;

  @ApiProperty({
    description: 'Tipo de comisión aplicada por el tenant',
    enum: FeeType,
    example: FeeType.PERCENTAGE,
  })
  feeType: FeeType;

  @ApiProperty({
    description: 'Total final a debitar de la cuenta origen (equivalente + comisión)',
    example: '102.00',
  })
  totalDebitAmount: string;
}

