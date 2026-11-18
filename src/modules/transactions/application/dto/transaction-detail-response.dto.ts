import { ApiProperty } from '@nestjs/swagger';
import { TransactionItemDto } from './transaction-item.dto';

export class LedgerEntryDetailDto {
  @ApiProperty({ description: 'ID del asiento contable', example: 'e718c321-2e63-4a62-97b5-2ea6572e5cc1' })
  id: string;

  @ApiProperty({ description: 'ID de la cuenta afectada', example: 'd8c72836-1f63-44f2-95bb-97645cf459ef' })
  accountId: string;

  @ApiProperty({ description: 'Tipo de movimiento contable (CREDIT o DEBIT)', example: 'DEBIT' })
  type: string;

  @ApiProperty({ description: 'Monto del asiento', example: '102.00' })
  amount: string;

  @ApiProperty({ description: 'Moneda del asiento', example: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Fecha y hora del asiento', example: '2026-11-12T14:35:00.000Z' })
  createdAt: string;
}

export class TransactionDetailResponseDto extends TransactionItemDto {
  @ApiProperty({
    type: [LedgerEntryDetailDto],
    description: 'Asientos contables registrados en el libro mayor (Ledger) para esta transacción',
  })
  ledgerEntries: LedgerEntryDetailDto[];
}

