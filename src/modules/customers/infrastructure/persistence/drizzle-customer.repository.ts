import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { Customer } from '../../domain/entities/customer.entity';
import type { CustomerRepository } from '../../application/ports/customer.repository.port';

@Injectable()
export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) {}

  async save(customer: Customer): Promise<void> {
    const info = await this.schemaResolver.resolve(customer.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.customersTable).values({
      id: customer.getId(),
      userId: customer.getUserId(),
      fullName: customer.getFullName(),
      documentNumber: customer.getDocumentNumber().trim(),
      email: customer.getEmail().trim().toLowerCase(),
      phone: customer.getPhone(),
      createdAt: customer.getCreatedAt(),
      updatedAt: customer.getUpdatedAt(),
    });

    // Auto-aprovisionar cuenta bancaria inicial activa con saldo 0.00 para el cliente registrado
    // Garantiza que el número de cuenta sea estrictamente único a nivel global entre todas las instituciones
    const schemas = await this.schemaResolver.getAllActiveSchemas();
    const prefix = info.schemaName.includes('bogota')
      ? '10'
      : (info.schemaName.includes('santander')
          ? '90'
          : (info.schemaName.includes('nu')
              ? '80'
              : (info.schemaName.includes('occidente') ? '50' : '70')));

    let accountNumber = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 15) {
      attempts++;
      const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
      accountNumber = `${prefix}${randomSuffix}`;

      let found = false;
      for (const s of schemas) {
        const t = getTenantTables(s.schemaName);
        const rows = await this.db
          .select({ acc: t.accountsTable.accountNumber })
          .from(t.accountsTable)
          .where(eq(t.accountsTable.accountNumber, accountNumber))
          .limit(1);
        if (rows.length > 0) {
          found = true;
          break;
        }
      }
      if (!found) {
        isUnique = true;
      }
    }

    const tenantCurrency = info.schemaName.includes('santander') ? 'USD' : 'COP';

    await this.db.insert(tables.accountsTable).values({
      id: randomUUID(),
      customerId: customer.getUserId(),
      accountNumber,
      currency: tenantCurrency,
      balance: '0.00',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async update(customer: Customer): Promise<void> {
    const info = await this.schemaResolver.resolve(customer.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db
      .update(tables.customersTable)
      .set({
        fullName: customer.getFullName(),
        email: customer.getEmail().trim().toLowerCase(),
        phone: customer.getPhone(),
        updatedAt: customer.getUpdatedAt(),
      })
      .where(eq(tables.customersTable.id, customer.getId()));
  }

  async findById(id: string, tenantId?: string): Promise<Customer | null> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.customersTable)
        .where(eq(tables.customersTable.id, id))
        .limit(1);

      if (rows.length === 0) return null;
      return this.mapToDomain(rows[0], info.tenantId);
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.customersTable)
        .where(eq(tables.customersTable.id, id))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }
    return null;
  }

  async findByUserId(userId: string, tenantId?: string): Promise<Customer | null> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.customersTable)
        .where(eq(tables.customersTable.userId, userId))
        .limit(1);

      if (rows.length === 0) return null;
      return this.mapToDomain(rows[0], info.tenantId);
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.customersTable)
        .where(eq(tables.customersTable.userId, userId))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }
    return null;
  }

  async findByDocumentNumber(
    tenantId: string,
    documentNumber: string,
  ): Promise<Customer | null> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db
      .select()
      .from(tables.customersTable)
      .where(eq(tables.customersTable.documentNumber, documentNumber.trim()))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0], info.tenantId);
  }

  async findAnyByDocumentNumber(documentNumber: string): Promise<Customer | null> {
    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.customersTable)
        .where(eq(tables.customersTable.documentNumber, documentNumber.trim()))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }
    return null;
  }

  async listByTenant(tenantId: string): Promise<Customer[]> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db.select().from(tables.customersTable);
    return rows.map((r) => this.mapToDomain(r, info.tenantId));
  }

  private mapToDomain(row: any, tenantId: string): Customer {
    return Customer.reconstitute({
      id: row.id,
      tenantId,
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
