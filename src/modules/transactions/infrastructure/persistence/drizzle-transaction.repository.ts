import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, lte, or } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
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
export class DrizzleTransactionRepository implements TransactionRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async save(transaction: Transaction): Promise<void> {
    const info = await this.schemaResolver.resolve(transaction.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.transactionsTable).values({
      id: transaction.getId(),
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

  async findById(id: string, tenantId?: string): Promise<Transaction | null> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.transactionsTable)
        .where(eq(tables.transactionsTable.id, id))
        .limit(1);

      if (rows.length === 0) return null;
      return this.mapToDomain(rows[0], info.tenantId);
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.transactionsTable)
        .where(eq(tables.transactionsTable.id, id))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }
    return null;
  }

  async findByTenant(tenantId: string): Promise<Transaction[]> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db.select().from(tables.transactionsTable);
    return rows.map((r) => this.mapToDomain(r, info.tenantId));
  }

  async findByAccount(accountId: string, tenantId?: string): Promise<Transaction[]> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.transactionsTable)
        .where(
          or(
            eq(tables.transactionsTable.sourceAccountId, accountId),
            eq(tables.transactionsTable.destinationAccountId, accountId),
          ),
        );

      return rows.map((r) => this.mapToDomain(r, info.tenantId));
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.transactionsTable)
        .where(
          or(
            eq(tables.transactionsTable.sourceAccountId, accountId),
            eq(tables.transactionsTable.destinationAccountId, accountId),
          ),
        );

      if (rows.length > 0) {
        return rows.map((r) => this.mapToDomain(r, schema.tenantId));
      }
    }
    return [];
  }

  async findPaginated(
    filter: TransactionQueryFilter,
  ): Promise<PaginatedResult<Transaction>> {
    const info = await this.schemaResolver.resolve(filter.tenantId);
    const tables = getTenantTables(info.schemaName);

    const conditions: any[] = [];

    if (filter.accountIds && filter.accountIds.length > 0) {
      conditions.push(
        or(
          inArray(tables.transactionsTable.sourceAccountId, filter.accountIds),
          inArray(tables.transactionsTable.destinationAccountId, filter.accountIds),
        )!,
      );
    }

    if (filter.type) {
      conditions.push(eq(tables.transactionsTable.type, filter.type));
    }

    if (filter.startDate) {
      conditions.push(gte(tables.transactionsTable.createdAt, filter.startDate));
    }

    if (filter.endDate) {
      conditions.push(lte(tables.transactionsTable.createdAt, filter.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = this.db
      .select({ count: count() })
      .from(tables.transactionsTable);
    const countResult = whereClause
      ? await countQuery.where(whereClause)
      : await countQuery;
    const total = Number(countResult[0]?.count ?? 0);

    const offset = (filter.page - 1) * filter.limit;

    let rowsQuery = this.db
      .select()
      .from(tables.transactionsTable);

    if (whereClause) {
      rowsQuery = rowsQuery.where(whereClause) as any;
    }

    const rows = await rowsQuery
      .orderBy(desc(tables.transactionsTable.createdAt), desc(tables.transactionsTable.id))
      .limit(filter.limit)
      .offset(offset);

    return {
      data: rows.map((r) => this.mapToDomain(r, info.tenantId)),
      total,
      page: filter.page,
      limit: filter.limit,
    };
  }

  private mapToDomain(row: any, tenantId: string): Transaction {
    return Transaction.reconstitute({
      id: row.id,
      tenantId,
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
