import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { customersTable, CustomerRecord } from '../../../../database/schema/users-customers.schema';
import { Customer } from '../../domain/entities/customer.entity';
import type { CustomerRepository } from '../../application/ports/customer.repository.port';

@Injectable()
export class DrizzleCustomerRepository
  implements CustomerRepository, OnModuleInit
{
  private readonly logger = new Logger(DrizzleCustomerRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.customers (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
          full_name VARCHAR(150) NOT NULL,
          document_number VARCHAR(50) NOT NULL,
          email VARCHAR(150) NOT NULL,
          phone VARCHAR(30),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT customers_tenant_doc_unique UNIQUE(tenant_id, document_number)
        );
      `);
      this.logger.log('Tabla public.customers verificada o inicializada.');
    } catch {
      this.logger.warn('No se pudo verificar la tabla public.customers en el arranque.');
    }
  }

  async save(customer: Customer): Promise<void> {
    await this.db.insert(customersTable).values({
      id: customer.getId(),
      tenantId: customer.getTenantId(),
      userId: customer.getUserId(),
      fullName: customer.getFullName(),
      documentNumber: customer.getDocumentNumber(),
      email: customer.getEmail(),
      phone: customer.getPhone(),
      createdAt: customer.getCreatedAt(),
      updatedAt: customer.getUpdatedAt(),
    });
  }

  async update(customer: Customer): Promise<void> {
    await this.db
      .update(customersTable)
      .set({
        fullName: customer.getFullName(),
        email: customer.getEmail(),
        phone: customer.getPhone(),
        updatedAt: customer.getUpdatedAt(),
      })
      .where(eq(customersTable.id, customer.getId()));
  }

  async findById(id: string): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByUserId(userId: string): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customersTable)
      .where(eq(customersTable.userId, userId))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByDocumentNumber(
    tenantId: string,
    documentNumber: string,
  ): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customersTable)
      .where(
        and(
          eq(customersTable.tenantId, tenantId),
          eq(customersTable.documentNumber, documentNumber.trim()),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async listByTenant(tenantId: string): Promise<Customer[]> {
    const rows = await this.db
      .select()
      .from(customersTable)
      .where(eq(customersTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: CustomerRecord): Customer {
    return Customer.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      fullName: row.fullName,
      documentNumber: row.documentNumber,
      email: row.email,
      phone: row.phone ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

