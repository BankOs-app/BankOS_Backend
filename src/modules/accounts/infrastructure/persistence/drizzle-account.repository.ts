import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { Account } from '../../domain/entities/account.entity';
import { AccountStatus } from '../../domain/value-objects/account-status.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import type { AccountRepository } from '../../application/ports/account.repository.port';

@Injectable()
export class DrizzleAccountRepository implements AccountRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async save(account: Account): Promise<void> {
    const info = await this.schemaResolver.resolve(account.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.accountsTable).values({
      id: account.getId(),
      customerId: account.getCustomerId(),
      accountNumber: account.getAccountNumber().trim(),
      currency: account.getCurrency(),
      balance: account.getBalance(),
      status: account.getStatus(),
      createdAt: account.getCreatedAt(),
      updatedAt: account.getUpdatedAt(),
    });
  }

  async update(account: Account): Promise<void> {
    const info = await this.schemaResolver.resolve(account.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db
      .update(tables.accountsTable)
      .set({
        balance: account.getBalance(),
        status: account.getStatus(),
        updatedAt: account.getUpdatedAt(),
      })
      .where(eq(tables.accountsTable.id, account.getId()));
  }

  async findById(id: string, tenantId?: string): Promise<Account | null> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.accountsTable)
        .where(eq(tables.accountsTable.id, id))
        .limit(1);

      if (rows.length === 0) return null;
      return this.mapToDomain(rows[0], info.tenantId);
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.accountsTable)
        .where(eq(tables.accountsTable.id, id))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }
    return null;
  }

  async findByNumber(
    tenantId: string,
    accountNumber: string,
  ): Promise<Account | null> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db
      .select()
      .from(tables.accountsTable)
      .where(eq(tables.accountsTable.accountNumber, accountNumber.trim()))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0], info.tenantId);
  }

  async findByNumberAcrossTenants(accountNumber: string): Promise<Account[]> {
    const schemas = await this.schemaResolver.getAllActiveSchemas();
    const matches: Account[] = [];
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.accountsTable)
        .where(eq(tables.accountsTable.accountNumber, accountNumber.trim()))
        .limit(2);
      matches.push(...rows.map((row) => this.mapToDomain(row, schema.tenantId)));
      if (matches.length > 1) return matches;
    }
    return matches;
  }

  async listByCustomer(customerId: string, tenantId?: string): Promise<Account[]> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.accountsTable)
        .where(eq(tables.accountsTable.customerId, customerId));

      return rows.map((r) => this.mapToDomain(r, info.tenantId));
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.accountsTable)
        .where(eq(tables.accountsTable.customerId, customerId));

      if (rows.length > 0) {
        return rows.map((r) => this.mapToDomain(r, schema.tenantId));
      }
    }
    return [];
  }

  async listByTenant(tenantId: string): Promise<Account[]> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db.select().from(tables.accountsTable);
    return rows.map((r) => this.mapToDomain(r, info.tenantId));
  }

  private mapToDomain(row: any, tenantId: string): Account {
    return Account.reconstitute({
      id: row.id,
      tenantId,
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
