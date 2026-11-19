import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { LedgerEntry } from '../../domain/entities/ledger-entry.entity';
import { LedgerEntryType } from '../../../transactions/domain/value-objects/transaction-types.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import type { LedgerRepository } from '../../application/ports/ledger.repository.port';

@Injectable()
export class DrizzleLedgerRepository implements LedgerRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async save(entry: LedgerEntry): Promise<void> {
    const info = await this.schemaResolver.resolve(entry.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.ledgerEntriesTable).values({
      id: entry.getId(),
      transactionId: entry.getTransactionId(),
      accountId: entry.getAccountId(),
      type: entry.getType(),
      amount: entry.getAmount(),
      currency: entry.getCurrency(),
      createdAt: entry.getCreatedAt(),
    });
  }

  async listByTransaction(
    transactionId: string,
    tenantId?: string,
  ): Promise<LedgerEntry[]> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.ledgerEntriesTable)
        .where(eq(tables.ledgerEntriesTable.transactionId, transactionId));

      return rows.map((r) => this.mapToDomain(r, info.tenantId));
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.ledgerEntriesTable)
        .where(eq(tables.ledgerEntriesTable.transactionId, transactionId));

      if (rows.length > 0) {
        return rows.map((r) => this.mapToDomain(r, schema.tenantId));
      }
    }
    return [];
  }

  async listByAccount(
    accountId: string,
    tenantId?: string,
  ): Promise<LedgerEntry[]> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.ledgerEntriesTable)
        .where(eq(tables.ledgerEntriesTable.accountId, accountId));

      return rows.map((r) => this.mapToDomain(r, info.tenantId));
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.ledgerEntriesTable)
        .where(eq(tables.ledgerEntriesTable.accountId, accountId));

      if (rows.length > 0) {
        return rows.map((r) => this.mapToDomain(r, schema.tenantId));
      }
    }
    return [];
  }

  private mapToDomain(row: any, tenantId: string): LedgerEntry {
    return LedgerEntry.reconstitute({
      id: row.id,
      tenantId,
      transactionId: row.transactionId,
      accountId: row.accountId,
      type: row.type as LedgerEntryType,
      amount: row.amount,
      currency: row.currency as Currency,
      createdAt: row.createdAt,
    });
  }
}
