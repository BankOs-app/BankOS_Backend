import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import { TransactionStatus } from '../../domain/value-objects/transaction-types.enum';

export class WithdrawResponseDto {
  @ApiProperty({
    description: 'Identificador único de la transacción registrada',
    example: 'd8c72836-1f63-44f2-95bb-97645cf459ef',
  })
  transactionId: string;

  @ApiProperty({
    description: 'Número de cuenta de donde se debitaron los fondos',
    example: '1001234567',
  })
  accountNumber: string;

  @ApiProperty({
    description: 'Monto debitado de la cuenta',
    example: '50.00',
  })
  amount: string;

  @ApiProperty({
    description: 'Moneda de la cuenta y del retiro',
    enum: Currency,
    example: Currency.COP,
  })
  currency: Currency;

  @ApiProperty({
    description: 'Nuevo saldo disponible en la cuenta tras el débito',
    example: '450.00',
  })
  newBalance: string;

  @ApiProperty({
    description: 'Estado final de la transacción',
    enum: TransactionStatus,
    example: TransactionStatus.SUCCESS,
  })
  status: TransactionStatus;

  @ApiProperty({
    description: 'Fecha y hora UTC de la operación',
    example: '2026-11-12T14:30:00.000Z',
  })
  createdAt: string;
}

