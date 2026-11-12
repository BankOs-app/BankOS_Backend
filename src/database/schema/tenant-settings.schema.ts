import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';

/**
 * Tabla central de configuraciones financieras por Tenant.
 */
export const tenantSettingsTable = pgTable('tenant_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' })
    .unique(),
  primaryCurrency: varchar('primary_currency', { length: 3 })
    .notNull()
    .default('COP'),
  maxTransactionAmount: numeric('max_transaction_amount', {
    precision: 18,
    scale: 2,
  })
    .notNull()
    .default('50000000.00'),
  feeType: varchar('fee_type', { length: 20 }).notNull().default('FIXED'),
  feeValue: numeric('fee_value', { precision: 18, scale: 4 })
    .notNull()
    .default('0.0000'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TenantSettingsRecord = typeof tenantSettingsTable.$inferSelect;

/**
 * Tabla central de tasas de cambio estáticas por Tenant.
 */
export const tenantExchangeRatesTable = pgTable(
  'tenant_exchange_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    fromCurrency: varchar('from_currency', { length: 3 }).notNull(),
    toCurrency: varchar('to_currency', { length: 3 }).notNull(),
    rate: numeric('rate', { precision: 18, scale: 6 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantPairIdx: uniqueIndex('tenant_exchange_rates_pair_idx').on(
      table.tenantId,
      table.fromCurrency,
      table.toCurrency,
    ),
  }),
);

export type TenantExchangeRateRecord =
  typeof tenantExchangeRatesTable.$inferSelect;

