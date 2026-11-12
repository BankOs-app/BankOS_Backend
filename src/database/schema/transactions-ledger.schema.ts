import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';
import { accountsTable } from './accounts.schema';

export const transactionsTable = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  sourceAccountId: uuid('source_account_id').references(
    () => accountsTable.id,
    { onDelete: 'set null' },
  ),
  destinationAccountId: uuid('destination_account_id').references(
    () => accountsTable.id,
    { onDelete: 'cascade' },
  ),
  originalAmount: numeric('original_amount', { precision: 18, scale: 2 }).notNull(),
  originalCurrency: varchar('original_currency', { length: 3 }).notNull(),
  convertedAmount: numeric('converted_amount', { precision: 18, scale: 2 }),
  destinationCurrency: varchar('destination_currency', { length: 3 }),
  exchangeRateApplied: numeric('exchange_rate_applied', {
    precision: 18,
    scale: 6,
  }),
  feeAmount: numeric('fee_amount', { precision: 18, scale: 4 }),
  status: varchar('status', { length: 20 }).notNull().default('SUCCESS'),
  idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TransactionRecord = typeof transactionsTable.$inferSelect;

export const ledgerEntriesTable = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactionsTable.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accountsTable.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LedgerEntryRecord = typeof ledgerEntriesTable.$inferSelect;
