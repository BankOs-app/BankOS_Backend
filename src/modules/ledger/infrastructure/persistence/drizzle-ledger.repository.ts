import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import {
  ledgerEntriesTable,
  LedgerEntryRecord,
} from '../../../../database/schema/transactions-ledger.schema';
import { LedgerEntry } from '../../domain/entities/ledger-entry.entity';
import { LedgerEntryType } from '../../../transactions/domain/value-objects/transaction-types.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import type { LedgerRepository } from '../../application/ports/ledger.repository.port';

@Injectable()
export class DrizzleLedgerRepository implements LedgerRepository, OnModuleInit {
  private readonly logger = new Logger(DrizzleLedgerRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.ledger_entries (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
          account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          amount NUMERIC(18, 2) NOT NULL,
          currency VARCHAR(3) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      this.logger.log('Tabla public.ledger_entries verificada o inicializada.');
    } catch {
      this.logger.warn('No se pudo verificar la tabla public.ledger_entries en el arranque.');
    }
  }

  async save(entry: LedgerEntry): Promise<void> {
    await this.db.insert(ledgerEntriesTable).values({
      id: entry.getId(),
      tenantId: entry.getTenantId(),
      transactionId: entry.getTransactionId(),
      accountId: entry.getAccountId(),
      type: entry.getType(),
      amount: entry.getAmount(),
      currency: entry.getCurrency(),
      createdAt: entry.getCreatedAt(),
    });
  }

  async listByTransaction(transactionId: string): Promise<LedgerEntry[]> {
    const rows = await this.db
      .select()
      .from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.transactionId, transactionId));

    return rows.map((r) => this.mapToDomain(r));
  }

  async listByAccount(accountId: string): Promise<LedgerEntry[]> {
    const rows = await this.db
      .select()
      .from(ledgerEntriesTable)
      .where(eq(ledgerEntriesTable.accountId, accountId));

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: LedgerEntryRecord): LedgerEntry {
    return LedgerEntry.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      transactionId: row.transactionId,
      accountId: row.accountId,
      type: row.type as LedgerEntryType,
      amount: row.amount,
      currency: row.currency as Currency,
      createdAt: row.createdAt,
    });
  }
}

