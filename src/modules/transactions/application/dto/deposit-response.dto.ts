import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import { TransactionStatus } from '../../domain/value-objects/transaction-types.enum';

export class DepositResponseDto {
  transactionId: string;
  accountNumber: string;
  amount: string;
  currency: Currency;
  newBalance: string;
  status: TransactionStatus;
  createdAt: string;
}

