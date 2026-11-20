import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { tenantsTable, TenantRecord } from '../../../../database/schema/tenants.schema';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { Tenant } from '../../domain/entities/tenant.entity';
import { TenantStatus } from '../../domain/value-objects/tenant-status.enum';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';
import type { TenantRepository } from '../../application/ports/tenant.repository.port';

/**
 * Adaptador de persistencia para Tenants utilizando Drizzle ORM y PostgreSQL.
 * Administra la tabla central public.tenants (catálogo global del SaaS).
 */
@Injectable()
export class DrizzleTenantRepository implements TenantRepository, OnModuleInit {
  private readonly logger = new Logger(DrizzleTenantRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.tenants (
          id UUID PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(50),
          subdomain VARCHAR(253),
          slug VARCHAR(50) NOT NULL UNIQUE,
          schema_name VARCHAR(63) NOT NULL UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'PROVISIONING',
          primary_currency VARCHAR(3) NOT NULL DEFAULT 'COP',
          max_transaction_amount NUMERIC(18, 2) NOT NULL DEFAULT 50000000.00,
          fee_type VARCHAR(20) NOT NULL DEFAULT 'FIXED',
          fee_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_currency VARCHAR(3) NOT NULL DEFAULT 'COP';
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS code VARCHAR(50);
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subdomain VARCHAR(253);
        UPDATE public.tenants SET code = UPPER(slug) WHERE code IS NULL;
        UPDATE public.tenants SET subdomain = slug || '.bankos.io' WHERE subdomain IS NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS tenants_code_unique_idx ON public.tenants (code);
        CREATE UNIQUE INDEX IF NOT EXISTS tenants_subdomain_unique_idx ON public.tenants (subdomain);
        ALTER TABLE public.tenants ALTER COLUMN code SET NOT NULL;
        ALTER TABLE public.tenants ALTER COLUMN subdomain SET NOT NULL;
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_transaction_amount NUMERIC(18, 2) NOT NULL DEFAULT 50000000.00;
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20) NOT NULL DEFAULT 'FIXED';
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS fee_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000;
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) NOT NULL DEFAULT '#0A2540';
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) NOT NULL DEFAULT '#0052FF';
        ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255) NOT NULL DEFAULT 'bankos';
      `);
      this.logger.log('Tabla central public.tenants verificada con parámetros financieros.');
    } catch {
      this.logger.warn(
        'No se pudo verificar la tabla public.tenants en el arranque.',
      );
    }
  }

  async save(tenant: Tenant): Promise<void> {
    await this.db.insert(tenantsTable).values({
      id: tenant.getId(),
      name: tenant.getName(),
      code: tenant.getCode(),
      subdomain: tenant.getSubdomain(),
      slug: tenant.getSlug().getValue(),
      schemaName: tenant.getSchemaName(),
      status: tenant.getStatus(),
      primaryCurrency: tenant.getPrimaryCurrency(),
      maxTransactionAmount: tenant.getMaxTransactionAmount(),
      feeType: tenant.getFeeType(),
      feeValue: tenant.getFeeValue(),
      primaryColor: tenant.getPrimaryColor(),
      accentColor: tenant.getAccentColor(),
      logoUrl: tenant.getLogoUrl(),
      createdAt: tenant.getCreatedAt(),
      updatedAt: tenant.getUpdatedAt(),
    });

    this.schemaResolver.registerInCache({
      schemaName: tenant.getSchemaName(),
      tenantId: tenant.getId(),
      slug: tenant.getSlug().getValue(),
    });
  }

  async update(tenant: Tenant): Promise<void> {
    await this.db
      .update(tenantsTable)
      .set({
        name: tenant.getName(),
        code: tenant.getCode(),
        subdomain: tenant.getSubdomain(),
        status: tenant.getStatus(),
        primaryCurrency: tenant.getPrimaryCurrency(),
        maxTransactionAmount: tenant.getMaxTransactionAmount(),
        feeType: tenant.getFeeType(),
        feeValue: tenant.getFeeValue(),
        primaryColor: tenant.getPrimaryColor(),
        accentColor: tenant.getAccentColor(),
        logoUrl: tenant.getLogoUrl(),
        updatedAt: tenant.getUpdatedAt(),
      })
      .where(eq(tenantsTable.id, tenant.getId()));

    this.schemaResolver.registerInCache({
      schemaName: tenant.getSchemaName(),
      tenantId: tenant.getId(),
      slug: tenant.getSlug().getValue(),
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const rows = await this.db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const tenant = this.mapToDomain(rows[0]);
    this.schemaResolver.registerInCache({
      schemaName: tenant.getSchemaName(),
      tenantId: tenant.getId(),
      slug: tenant.getSlug().getValue(),
    });
    return tenant;
  }

  async findById(id: string): Promise<Tenant | null> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    if (!isUuid) {
      return this.findBySlug(id);
    }
    const rows = await this.db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const tenant = this.mapToDomain(rows[0]);
    this.schemaResolver.registerInCache({
      schemaName: tenant.getSchemaName(),
      tenantId: tenant.getId(),
      slug: tenant.getSlug().getValue(),
    });
    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    const rows = await this.db.select().from(tenantsTable);
    return rows.map((row) => this.mapToDomain(row));
  }

  private mapToDomain(row: TenantRecord): Tenant {
    return Tenant.reconstitute({
      id: row.id,
      name: row.name,
      code: row.code,
      subdomain: row.subdomain,
      slug: row.slug,
      schemaName: row.schemaName,
      status: row.status as TenantStatus,
      primaryCurrency: (row.primaryCurrency as Currency) ?? Currency.COP,
      maxTransactionAmount: row.maxTransactionAmount ?? '50000000.00',
      feeType: (row.feeType as FeeType) ?? FeeType.FIXED,
      feeValue: row.feeValue ?? '0.0000',
      primaryColor: row.primaryColor ?? '#0A2540',
      accentColor: row.accentColor ?? '#0052FF',
      logoUrl: row.logoUrl ?? 'bankos',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
