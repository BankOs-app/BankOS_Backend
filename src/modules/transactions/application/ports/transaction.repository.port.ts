import { Transaction } from '../../domain/entities/transaction.entity';
import { TransactionType } from '../../domain/value-objects/transaction-types.enum';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionQueryFilter {
  tenantId: string;
  accountIds?: string[];
  type?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TransactionRepository {
  save(transaction: Transaction): Promise<void>;
  findById(id: string): Promise<Transaction | null>;
  findByTenant(tenantId: string): Promise<Transaction[]>;
  findByAccount(accountId: string): Promise<Transaction[]>;
  findPaginated(filter: TransactionQueryFilter): Promise<PaginatedResult<Transaction>>;
}
