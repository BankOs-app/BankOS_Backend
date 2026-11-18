import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import {
  tenantSettingsTable,
  TenantSettingsRecord,
} from '../../../../database/schema/tenant-settings.schema';
import { TenantSettings } from '../../domain/entities/tenant-settings.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';
import type { TenantSettingsRepository } from '../../application/ports/tenant-settings.repository.port';

@Injectable()
export class DrizzleTenantSettingsRepository
  implements TenantSettingsRepository, OnModuleInit
{
  private readonly logger = new Logger(DrizzleTenantSettingsRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.tenant_settings (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
          primary_currency VARCHAR(3) NOT NULL DEFAULT 'COP',
          max_transaction_amount NUMERIC(18, 2) NOT NULL DEFAULT 50000000.00,
          fee_type VARCHAR(20) NOT NULL DEFAULT 'FIXED',
          fee_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      this.logger.log('Tabla public.tenant_settings verificada o inicializada.');
    } catch {
      this.logger.warn(
        'No se pudo verificar la tabla public.tenant_settings en el arranque.',
      );
    }
  }

  async findByTenantId(tenantId: string): Promise<TenantSettings | null> {
    const rows = await this.db
      .select()
      .from(tenantSettingsTable)
      .where(eq(tenantSettingsTable.tenantId, tenantId))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDomain(rows[0]);
  }

  async save(settings: TenantSettings): Promise<void> {
    await this.db.insert(tenantSettingsTable).values({
      id: settings.getId(),
      tenantId: settings.getTenantId(),
      primaryCurrency: settings.getPrimaryCurrency(),
      maxTransactionAmount: settings.getMaxTransactionAmount(),
      feeType: settings.getFeeType(),
      feeValue: settings.getFeeValue(),
      createdAt: settings.getCreatedAt(),
      updatedAt: settings.getUpdatedAt(),
    });
  }

  async update(settings: TenantSettings): Promise<void> {
    await this.db
      .update(tenantSettingsTable)
      .set({
        primaryCurrency: settings.getPrimaryCurrency(),
        maxTransactionAmount: settings.getMaxTransactionAmount(),
        feeType: settings.getFeeType(),
        feeValue: settings.getFeeValue(),
        updatedAt: settings.getUpdatedAt(),
      })
      .where(eq(tenantSettingsTable.tenantId, settings.getTenantId()));
  }

  private mapToDomain(row: TenantSettingsRecord): TenantSettings {
    return TenantSettings.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      primaryCurrency: row.primaryCurrency as Currency,
      maxTransactionAmount: row.maxTransactionAmount,
      feeType: row.feeType as FeeType,
      feeValue: row.feeValue,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

