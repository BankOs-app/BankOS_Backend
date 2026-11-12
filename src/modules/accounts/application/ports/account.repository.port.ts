import { Account } from '../../domain/entities/account.entity';

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

export interface AccountRepository {
  save(account: Account): Promise<void>;
  update(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findByNumber(tenantId: string, accountNumber: string): Promise<Account | null>;
  listByCustomer(customerId: string): Promise<Account[]>;
  listByTenant(tenantId: string): Promise<Account[]>;
}

