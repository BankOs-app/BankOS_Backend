import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';
import { customersTable } from './users-customers.schema';

/**
 * Tabla de Cuentas Bancarias (`accounts`).
 *
 * Representa cuentas monetarias asociadas a un cliente y a un banco (tenant):
 * - Moneda ISO 4217 (COP, USD, EUR).
 * - Balance con precisión fija numeric(18, 2).
 * - Estados de cuenta: ACTIVE, BLOCKED, INACTIVE (Soft Delete).
 * - Índice único compuesto `accounts_tenant_number_idx` sobre (tenant_id, account_number)
 *   que garantiza que los números de cuenta no se repitan dentro del mismo banco,
 *   permitiendo que distintos bancos manejen sus propias secuencias de cuentas sin colisionar.
 */
export const accountsTable = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customersTable.id, { onDelete: 'cascade' }),
    accountNumber: varchar('account_number', { length: 30 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    balance: numeric('balance', { precision: 18, scale: 2 })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantAccountIdx: uniqueIndex('accounts_tenant_number_idx').on(
      table.tenantId,
      table.accountNumber,
    ),
  }),
);

export type AccountRecord = typeof accountsTable.$inferSelect;
export type NewAccountRecord = typeof accountsTable.$inferInsert;


