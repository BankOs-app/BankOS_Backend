import { ApiProperty } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '../../domain/value-objects/transaction-types.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';

export class TransactionItemDto {
  @ApiProperty({
    description: 'Identificador único de la transacción',
    example: 'cb9b8612-fc1e-45fa-aeb7-e1687f1efd97',
  })
  id: string;

  @ApiProperty({
    description: 'Tipo de operación financiera',
    enum: TransactionType,
    example: TransactionType.TRANSFER,
  })
  type: TransactionType;

  @ApiProperty({
    description: 'ID de cuenta de origen (si aplica)',
    required: false,
    example: 'd8c72836-1f63-44f2-95bb-97645cf459ef',
  })
  sourceAccountId?: string;

  @ApiProperty({
    description: 'ID de cuenta de destino (si aplica)',
    required: false,
    example: 'a718c321-2e63-4a62-97b5-2ea6572e5cc1',
  })
  destinationAccountId?: string;

  @ApiProperty({
    description: 'Monto original de la operación en moneda de origen',
    example: '100.00',
  })
  originalAmount: string;

  @ApiProperty({
    description: 'Moneda original',
    enum: Currency,
    example: Currency.USD,
  })
  originalCurrency: Currency;

  @ApiProperty({
    description: 'Monto recibido o convertido en destino (si aplica)',
    required: false,
    example: '400000.00',
  })
  convertedAmount?: string;

  @ApiProperty({
    description: 'Moneda de destino (si aplica)',
    required: false,
    enum: Currency,
    example: Currency.COP,
  })
  destinationCurrency?: Currency;

  @ApiProperty({
    description: 'Tasa estática aplicada en la conversión (si aplica)',
    required: false,
    example: '4000.000000',
  })
  exchangeRateApplied?: string;

  @ApiProperty({
    description: 'Comisión cobrada por la operación (si aplica)',
    required: false,
    example: '2.00',
  })
  feeAmount?: string;

  @ApiProperty({
    description: 'Indica si la transacción tuvo cobro de comisión (etiqueta visual en UI - CA-HU-11-04)',
    example: true,
  })
  hasFee: boolean;

  @ApiProperty({
    description: 'Indica si la transacción involucró conversión de divisas (etiqueta visual en UI - CA-HU-11-04)',
    example: true,
  })
  hasConversion: boolean;

  @ApiProperty({
    description: 'Estado de la operación',
    enum: TransactionStatus,
    example: TransactionStatus.SUCCESS,
  })
  status: TransactionStatus;

  @ApiProperty({
    description: 'Fecha y hora UTC en que se registró la transacción',
    example: '2026-11-12T14:35:00.000Z',
  })
  createdAt: string;
}

