import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, lte, or } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import {
  transactionsTable,
  TransactionRecord,
} from '../../../../database/schema/transactions-ledger.schema';
import { Transaction } from '../../domain/entities/transaction.entity';
import {
  TransactionType,
  TransactionStatus,
} from '../../domain/value-objects/transaction-types.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import type {
  TransactionRepository,
  TransactionQueryFilter,
  PaginatedResult,
} from '../../application/ports/transaction.repository.port';

@Injectable()
export class DrizzleTransactionRepository
  implements TransactionRepository, OnModuleInit
{
  private readonly logger = new Logger(DrizzleTransactionRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.transactions (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          source_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
          destination_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
          original_amount NUMERIC(18, 2) NOT NULL,
          original_currency VARCHAR(3) NOT NULL,
          converted_amount NUMERIC(18, 2),
          destination_currency VARCHAR(3),
          exchange_rate_applied NUMERIC(18, 6),
          fee_amount NUMERIC(18, 4),
          status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
          idempotency_key VARCHAR(100) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      this.logger.log('Tabla public.transactions verificada o inicializada.');
    } catch {
      this.logger.warn('No se pudo verificar la tabla public.transactions en el arranque.');
    }
  }

  async save(transaction: Transaction): Promise<void> {
    await this.db.insert(transactionsTable).values({
      id: transaction.getId(),
      tenantId: transaction.getTenantId(),
      type: transaction.getType(),
      sourceAccountId: transaction.getSourceAccountId() ?? null,
      destinationAccountId: transaction.getDestinationAccountId() ?? null,
      originalAmount: transaction.getOriginalAmount(),
      originalCurrency: transaction.getOriginalCurrency(),
      convertedAmount: transaction.getConvertedAmount() ?? null,
      destinationCurrency: transaction.getDestinationCurrency() ?? null,
      exchangeRateApplied: transaction.getExchangeRateApplied() ?? null,
      feeAmount: transaction.getFeeAmount() ?? null,
      status: transaction.getStatus(),
      idempotencyKey: transaction.getIdempotencyKey(),
      createdAt: transaction.getCreatedAt(),
    });
  }

  async findById(id: string): Promise<Transaction | null> {
    const rows = await this.db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByTenant(tenantId: string): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }

  async findByAccount(accountId: string): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactionsTable)
      .where(
        or(
          eq(transactionsTable.sourceAccountId, accountId),
          eq(transactionsTable.destinationAccountId, accountId),
        ),
      );

    return rows.map((r) => this.mapToDomain(r));
  }

  async findPaginated(
    filter: TransactionQueryFilter,
  ): Promise<PaginatedResult<Transaction>> {
    const conditions = [eq(transactionsTable.tenantId, filter.tenantId)];

    if (filter.accountIds && filter.accountIds.length > 0) {
      conditions.push(
        or(
          inArray(transactionsTable.sourceAccountId, filter.accountIds),
          inArray(transactionsTable.destinationAccountId, filter.accountIds),
        )!,
      );
    }

    if (filter.type) {
      conditions.push(eq(transactionsTable.type, filter.type));
    }

    if (filter.startDate) {
      conditions.push(gte(transactionsTable.createdAt, filter.startDate));
    }

    if (filter.endDate) {
      conditions.push(lte(transactionsTable.createdAt, filter.endDate));
    }

    const whereClause = and(...conditions);

    const countResult = await this.db
      .select({ count: count() })
      .from(transactionsTable)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    const offset = (filter.page - 1) * filter.limit;

    const rows = await this.db
      .select()
      .from(transactionsTable)
      .where(whereClause)
      .orderBy(desc(transactionsTable.createdAt), desc(transactionsTable.id))
      .limit(filter.limit)
      .offset(offset);

    return {
      data: rows.map((r) => this.mapToDomain(r)),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  private mapToDomain(row: TransactionRecord): Transaction {
    return Transaction.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      type: row.type as TransactionType,
      sourceAccountId: row.sourceAccountId ?? undefined,
      destinationAccountId: row.destinationAccountId ?? undefined,
      originalAmount: row.originalAmount,
      originalCurrency: row.originalCurrency as Currency,
      convertedAmount: row.convertedAmount ?? undefined,
      destinationCurrency: (row.destinationCurrency as Currency) ?? undefined,
      exchangeRateApplied: row.exchangeRateApplied ?? undefined,
      feeAmount: row.feeAmount ?? undefined,
      status: row.status as TransactionStatus,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
    });
  }
}
