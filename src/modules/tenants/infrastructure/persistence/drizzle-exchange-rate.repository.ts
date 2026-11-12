import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import {
  tenantExchangeRatesTable,
  TenantExchangeRateRecord,
} from '../../../../database/schema/tenant-settings.schema';
import { ExchangeRate } from '../../domain/entities/exchange-rate.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import type { ExchangeRateRepository } from '../../application/ports/exchange-rate.repository.port';

@Injectable()
export class DrizzleExchangeRateRepository
  implements ExchangeRateRepository, OnModuleInit
{
  private readonly logger = new Logger(DrizzleExchangeRateRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.tenant_exchange_rates (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          from_currency VARCHAR(3) NOT NULL,
          to_currency VARCHAR(3) NOT NULL,
          rate NUMERIC(18, 6) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT tenant_exchange_rates_pair_unique UNIQUE(tenant_id, from_currency, to_currency)
        );
      `);
      this.logger.log('Tabla public.tenant_exchange_rates verificada o inicializada.');
    } catch {
      this.logger.warn(
        'No se pudo verificar la tabla public.tenant_exchange_rates en el arranque.',
      );
    }
  }

  async findRate(
    tenantId: string,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<ExchangeRate | null> {
    const rows = await this.db
      .select()
      .from(tenantExchangeRatesTable)
      .where(
        and(
          eq(tenantExchangeRatesTable.tenantId, tenantId),
          eq(tenantExchangeRatesTable.fromCurrency, fromCurrency),
          eq(tenantExchangeRatesTable.toCurrency, toCurrency),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDomain(rows[0]);
  }

  async listByTenantId(tenantId: string): Promise<ExchangeRate[]> {
    const rows = await this.db
      .select()
      .from(tenantExchangeRatesTable)
      .where(eq(tenantExchangeRatesTable.tenantId, tenantId));

    return rows.map((row) => this.mapToDomain(row));
  }

  async saveOrUpdate(exchangeRate: ExchangeRate): Promise<void> {
    const existing = await this.findRate(
      exchangeRate.getTenantId(),
      exchangeRate.getFromCurrency(),
      exchangeRate.getToCurrency(),
    );

    if (existing) {
      await this.db
        .update(tenantExchangeRatesTable)
        .set({
          rate: exchangeRate.getRate(),
          updatedAt: exchangeRate.getUpdatedAt(),
        })
        .where(
          and(
            eq(tenantExchangeRatesTable.tenantId, exchangeRate.getTenantId()),
            eq(
              tenantExchangeRatesTable.fromCurrency,
              exchangeRate.getFromCurrency(),
            ),
            eq(
              tenantExchangeRatesTable.toCurrency,
              exchangeRate.getToCurrency(),
            ),
          ),
        );
    } else {
      await this.db.insert(tenantExchangeRatesTable).values({
        id: exchangeRate.getId(),
        tenantId: exchangeRate.getTenantId(),
        fromCurrency: exchangeRate.getFromCurrency(),
        toCurrency: exchangeRate.getToCurrency(),
        rate: exchangeRate.getRate(),
        createdAt: exchangeRate.getCreatedAt(),
        updatedAt: exchangeRate.getUpdatedAt(),
      });
    }
  }

  private mapToDomain(row: TenantExchangeRateRecord): ExchangeRate {
    return ExchangeRate.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      fromCurrency: row.fromCurrency as Currency,
      toCurrency: row.toCurrency as Currency,
      rate: row.rate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

