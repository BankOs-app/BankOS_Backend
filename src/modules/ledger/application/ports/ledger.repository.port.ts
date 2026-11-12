import { LedgerEntry } from '../../domain/entities/ledger-entry.entity';

export const LEDGER_REPOSITORY = Symbol('LEDGER_REPOSITORY');

export interface LedgerRepository {
  save(entry: LedgerEntry): Promise<void>;
  listByTransaction(transactionId: string): Promise<LedgerEntry[]>;
  listByAccount(accountId: string): Promise<LedgerEntry[]>;
}

