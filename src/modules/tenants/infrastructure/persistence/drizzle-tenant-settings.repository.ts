import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { TenantSettings } from '../../domain/entities/tenant-settings.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';
import type { TenantSettingsRepository } from '../../application/ports/tenant-settings.repository.port';

@Injectable()
export class DrizzleTenantSettingsRepository implements TenantSettingsRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async findByTenantId(tenantId: string): Promise<TenantSettings | null> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db.select().from(tables.tenantSettingsTable).limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDomain(rows[0], info.tenantId);
  }

  async save(settings: TenantSettings): Promise<void> {
    const info = await this.schemaResolver.resolve(settings.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.tenantSettingsTable).values({
      id: settings.getId(),
      primaryCurrency: settings.getPrimaryCurrency(),
      maxTransactionAmount: settings.getMaxTransactionAmount(),
      feeType: settings.getFeeType(),
      feeValue: settings.getFeeValue(),
      createdAt: settings.getCreatedAt(),
      updatedAt: settings.getUpdatedAt(),
    });
  }

  async update(settings: TenantSettings): Promise<void> {
    const info = await this.schemaResolver.resolve(settings.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db
      .update(tables.tenantSettingsTable)
      .set({
        primaryCurrency: settings.getPrimaryCurrency(),
        maxTransactionAmount: settings.getMaxTransactionAmount(),
        feeType: settings.getFeeType(),
        feeValue: settings.getFeeValue(),
        updatedAt: settings.getUpdatedAt(),
      })
      .where(eq(tables.tenantSettingsTable.id, settings.getId()));
  }

  private mapToDomain(row: any, tenantId: string): TenantSettings {
    return TenantSettings.reconstitute({
      id: row.id,
      tenantId,
      primaryCurrency: row.primaryCurrency as Currency,
      maxTransactionAmount: row.maxTransactionAmount,
      feeType: row.feeType as FeeType,
      feeValue: row.feeValue,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
