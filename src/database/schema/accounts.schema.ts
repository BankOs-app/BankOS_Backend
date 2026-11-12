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

