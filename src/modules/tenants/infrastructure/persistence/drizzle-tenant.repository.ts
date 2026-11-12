import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { tenantsTable, TenantRecord } from '../../../../database/schema/tenants.schema';
import { Tenant } from '../../domain/entities/tenant.entity';
import { TenantStatus } from '../../domain/value-objects/tenant-status.enum';
import type { TenantRepository } from '../../application/ports/tenant.repository.port';

/**
 * Adaptador de persistencia para Tenants utilizando Drizzle ORM y PostgreSQL.
 *
 * Implementa el puerto `TenantRepository` respetando el principio de Inversión
 * de Dependencias (DIP) de SOLID.
 */
@Injectable()
export class DrizzleTenantRepository implements TenantRepository, OnModuleInit {
  private readonly logger = new Logger(DrizzleTenantRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  /**
   * Al iniciar el módulo, aseguramos que la tabla central public.tenants
   * exista si aún no se han ejecutado las migraciones manuales.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.tenants (
          id UUID PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(50) NOT NULL UNIQUE,
          schema_name VARCHAR(63) NOT NULL UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'PROVISIONING',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      this.logger.log('Tabla public.tenants verificada o inicializada.');
    } catch {
      this.logger.warn(
        'No se pudo verificar la tabla public.tenants en el arranque (posiblemente la DB aún no está disponible en este momento).',
      );
    }
  }

  async save(tenant: Tenant): Promise<void> {
    await this.db.insert(tenantsTable).values({
      id: tenant.getId(),
      name: tenant.getName(),
      slug: tenant.getSlug().getValue(),
      schemaName: tenant.getSchemaName(),
      status: tenant.getStatus(),
      createdAt: tenant.getCreatedAt(),
      updatedAt: tenant.getUpdatedAt(),
    });
  }

  async update(tenant: Tenant): Promise<void> {
    await this.db
      .update(tenantsTable)
      .set({
        name: tenant.getName(),
        status: tenant.getStatus(),
        updatedAt: tenant.getUpdatedAt(),
      })
      .where(eq(tenantsTable.id, tenant.getId()));
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

    return this.mapToDomain(rows[0]);
  }

  async findById(id: string): Promise<Tenant | null> {
    const rows = await this.db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToDomain(rows[0]);
  }

  async findAll(): Promise<Tenant[]> {
    const rows = await this.db.select().from(tenantsTable);
    return rows.map((row) => this.mapToDomain(row));
  }

  private mapToDomain(row: TenantRecord): Tenant {
    return Tenant.reconstitute({
      id: row.id,
      name: row.name,
      slug: row.slug,
      schemaName: row.schemaName,
      status: row.status as TenantStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
