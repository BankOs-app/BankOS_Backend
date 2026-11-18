import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { accountsTable, AccountRecord } from '../../../../database/schema/accounts.schema';
import { Account } from '../../domain/entities/account.entity';
import { AccountStatus } from '../../domain/value-objects/account-status.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import type { AccountRepository } from '../../application/ports/account.repository.port';

@Injectable()
export class DrizzleAccountRepository
  implements AccountRepository, OnModuleInit
{
  private readonly logger = new Logger(DrizzleAccountRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.accounts (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
          account_number VARCHAR(30) NOT NULL,
          currency VARCHAR(3) NOT NULL,
          balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT accounts_tenant_number_unique UNIQUE(tenant_id, account_number)
        );
      `);
      this.logger.log('Tabla public.accounts verificada o inicializada.');
    } catch {
      this.logger.warn('No se pudo verificar la tabla public.accounts en el arranque.');
    }
  }

  async save(account: Account): Promise<void> {
    await this.db.insert(accountsTable).values({
      id: account.getId(),
      tenantId: account.getTenantId(),
      customerId: account.getCustomerId(),
      accountNumber: account.getAccountNumber(),
      currency: account.getCurrency(),
      balance: account.getBalance(),
      status: account.getStatus(),
      createdAt: account.getCreatedAt(),
      updatedAt: account.getUpdatedAt(),
    });
  }

  async update(account: Account): Promise<void> {
    await this.db
      .update(accountsTable)
      .set({
        balance: account.getBalance(),
        status: account.getStatus(),
        updatedAt: account.getUpdatedAt(),
      })
      .where(eq(accountsTable.id, account.getId()));
  }

  async findById(id: string): Promise<Account | null> {
    const rows = await this.db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByNumber(
    tenantId: string,
    accountNumber: string,
  ): Promise<Account | null> {
    const rows = await this.db
      .select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.tenantId, tenantId),
          eq(accountsTable.accountNumber, accountNumber.trim()),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async listByCustomer(customerId: string): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.customerId, customerId));

    return rows.map((r) => this.mapToDomain(r));
  }

  async listByTenant(tenantId: string): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: AccountRecord): Account {
    return Account.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      customerId: row.customerId,
      accountNumber: row.accountNumber,
      currency: row.currency as Currency,
      balance: row.balance,
      status: row.status as AccountStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

