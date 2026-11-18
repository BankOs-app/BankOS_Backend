import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import { TransactionStatus } from '../../domain/value-objects/transaction-types.enum';

export class TransferResponseDto {
  @ApiProperty({
    description: 'Identificador único de la transacción generada',
    example: 'cb9b8612-fc1e-45fa-aeb7-e1687f1efd97',
  })
  transactionId: string;

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
    description: 'Número de cuenta de destino',
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
    description: 'Monto neto recibido en la cuenta de destino',
    example: '400000.00',
  })
  targetAmount: string;

  @ApiProperty({
    description: 'Monto equivalente de la transferencia en la moneda de origen',
    example: '100.00',
  })
  sourceEquivalentAmount: string;

  @ApiProperty({
    description: 'Tasa de cambio estática aplicada',
    example: '4000.000000',
  })
  exchangeRateApplied: string;

  @ApiProperty({
    description: 'Comisión cobrada en moneda de origen',
    example: '2.00',
  })
  feeAmount: string;

  @ApiProperty({
    description: 'Total total debitado de la cuenta origen (monto equivalente + comisión)',
    example: '102.00',
  })
  totalDebited: string;

  @ApiProperty({
    description: 'Nuevo saldo disponible en la cuenta origen tras la transferencia',
    example: '898.00',
  })
  sourceNewBalance: string;

  @ApiProperty({
    description: 'Estado de la transacción',
    enum: TransactionStatus,
    example: TransactionStatus.SUCCESS,
  })
  status: TransactionStatus;

  @ApiProperty({
    description: 'Fecha y hora UTC de la operación',
    example: '2026-11-12T14:35:00.000Z',
  })
  createdAt: string;
}

