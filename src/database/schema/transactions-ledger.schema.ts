import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';
import { accountsTable } from './accounts.schema';

/**
 * Tabla de Transacciones Financieras (`transactions`).
 *
 * Registra cada operación de alto nivel ejecutada en el sistema (DEPOSIT, WITHDRAWAL, TRANSFER):
 * - Soporta operaciones multimoneda guardando el monto original, monto convertido y tasa aplicada.
 * - Registra la comisión (`feeAmount`) deducida durante la operación.
 * - Vincula la `idempotencyKey` para garantizar que peticiones repetidas retornen el mismo resultado.
 */
export const transactionsTable = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // DEPOSIT | WITHDRAWAL | TRANSFER
  sourceAccountId: uuid('source_account_id').references(
    () => accountsTable.id,
    { onDelete: 'set null' },
  ),
  destinationAccountId: uuid('destination_account_id').references(
    () => accountsTable.id,
    { onDelete: 'cascade' },
  ),
  // numeric(18, 2): Precisión fija de 18 dígitos con 2 decimales para evitar errores de coma flotante
  originalAmount: numeric('original_amount', { precision: 18, scale: 2 }).notNull(),
  originalCurrency: varchar('original_currency', { length: 3 }).notNull(),
  convertedAmount: numeric('converted_amount', { precision: 18, scale: 2 }),
  destinationCurrency: varchar('destination_currency', { length: 3 }),
  // numeric(18, 6): Hasta 6 decimales para tasas de cambio cambiarias de alta precisión
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

/**
 * Libro Contable de Doble Entrada (`ledger_entries`).
 *
 * En un sistema bancario formal, el saldo de una cuenta nunca debe modificarse sin
 * una entrada contable correspondiente e inmutable (asiento de débito o crédito):
 * - DEBIT: Disminución de saldo (ej. retiro o débito en cuenta origen).
 * - CREDIT: Aumento de saldo (ej. depósito o abono en cuenta destino).
 * Cada transacción genera 1 o más asientos en el Ledger asociados atómicamente.
 */
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
  type: varchar('type', { length: 20 }).notNull(), // DEBIT | CREDIT
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LedgerEntryRecord = typeof ledgerEntriesTable.$inferSelect;

