import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { ExchangeRate } from '../../domain/entities/exchange-rate.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import type { ExchangeRateRepository } from '../../application/ports/exchange-rate.repository.port';

@Injectable()
export class DrizzleExchangeRateRepository implements ExchangeRateRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async findRate(
    tenantId: string,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<ExchangeRate | null> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db
      .select()
      .from(tables.exchangeRatesTable)
      .where(
        and(
          eq(tables.exchangeRatesTable.fromCurrency, fromCurrency),
          eq(tables.exchangeRatesTable.toCurrency, toCurrency),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDomain(rows[0], info.tenantId);
  }

  async listByTenantId(tenantId: string): Promise<ExchangeRate[]> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db.select().from(tables.exchangeRatesTable);
    return rows.map((row) => this.mapToDomain(row, info.tenantId));
  }

  async saveOrUpdate(exchangeRate: ExchangeRate): Promise<void> {
    const info = await this.schemaResolver.resolve(exchangeRate.getTenantId());
    const tables = getTenantTables(info.schemaName);

    const existing = await this.findRate(
      info.tenantId,
      exchangeRate.getFromCurrency(),
      exchangeRate.getToCurrency(),
    );

    if (existing) {
      await this.db
        .update(tables.exchangeRatesTable)
        .set({
          rate: exchangeRate.getRate(),
          updatedAt: exchangeRate.getUpdatedAt(),
        })
        .where(
          and(
            eq(tables.exchangeRatesTable.fromCurrency, exchangeRate.getFromCurrency()),
            eq(tables.exchangeRatesTable.toCurrency, exchangeRate.getToCurrency()),
          ),
        );
    } else {
      await this.db.insert(tables.exchangeRatesTable).values({
        id: exchangeRate.getId(),
        fromCurrency: exchangeRate.getFromCurrency(),
        toCurrency: exchangeRate.getToCurrency(),
        rate: exchangeRate.getRate(),
        createdAt: exchangeRate.getCreatedAt(),
        updatedAt: exchangeRate.getUpdatedAt(),
      });
    }
  }

  private mapToDomain(row: any, tenantId: string): ExchangeRate {
    return ExchangeRate.reconstitute({
      id: row.id,
      tenantId,
      fromCurrency: row.fromCurrency as Currency,
      toCurrency: row.toCurrency as Currency,
      rate: row.rate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
