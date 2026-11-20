import {
  pgSchema,
  uuid,
  varchar,
  timestamp,
  numeric,
  integer,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';

export function createTenantTables(schemaName: string) {
  const schema = pgSchema(schemaName);

  const usersTable = schema.table('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 150 }).notNull().unique(),
    role: varchar('role', { length: 20 }).notNull().default('customer'),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    passwordHash: varchar('password_hash', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  });

  const customersTable = schema.table('customers', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' })
      .unique(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    documentNumber: varchar('document_number', { length: 50 }).notNull().unique(),
    email: varchar('email', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  });

  const accountsTable = schema.table('accounts', {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'restrict' }),
    accountNumber: varchar('account_number', { length: 30 }).notNull().unique(),
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
  });

  const transactionsTable = schema.table('transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 20 }).notNull(),
    sourceAccountId: uuid('source_account_id').references(
      () => accountsTable.id,
      { onDelete: 'set null' },
    ),
    destinationAccountId: uuid('destination_account_id'),
    sourceTenantId: varchar('source_tenant_id', { length: 100 }),
    destinationTenantId: varchar('destination_tenant_id', { length: 100 }),
    originalAmount: numeric('original_amount', {
      precision: 18,
      scale: 2,
    }).notNull(),
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

  const ledgerEntriesTable = schema.table('ledger_entries', {
    id: uuid('id').primaryKey().defaultRandom(),
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

  const tenantSettingsTable = schema.table('tenant_settings', {
    id: uuid('id').primaryKey().defaultRandom(),
    primaryCurrency: varchar('primary_currency', { length: 3 })
      .notNull()
      .default('COP'),
    maxTransactionAmount: numeric('max_transaction_amount', {
      precision: 18,
      scale: 2,
    })
      .notNull()
      .default('10000000.00'),
    feeType: varchar('fee_type', { length: 10 }).notNull().default('FIXED'),
    feeValue: numeric('fee_value', { precision: 18, scale: 4 })
      .notNull()
      .default('0.00'),
    primaryColor: varchar('primary_color', { length: 20 })
      .notNull()
      .default('#0A2540'),
    accentColor: varchar('accent_color', { length: 20 })
      .notNull()
      .default('#0052FF'),
    logoUrl: varchar('logo_url', { length: 255 })
      .notNull()
      .default('bankos'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  });

  const exchangeRatesTable = schema.table('tenant_exchange_rates', {
    id: uuid('id').primaryKey().defaultRandom(),
    fromCurrency: varchar('from_currency', { length: 3 }).notNull(),
    toCurrency: varchar('to_currency', { length: 3 }).notNull(),
    rate: numeric('rate', { precision: 18, scale: 6 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  });

  const idempotencyRecordsTable = schema.table('idempotency_records', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 100 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PROCESSING'),
    responseCode: integer('response_code'),
    responseBody: jsonb('response_body'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  });

  const auditLogsTable = schema.table('audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: varchar('actor_id', { length: 100 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    resource: varchar('resource', { length: 50 }).notNull(),
    resourceId: varchar('resource_id', { length: 100 }).notNull(),
    previousValues: jsonb('previous_values'),
    newValues: jsonb('new_values'),
    correlationId: varchar('correlation_id', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  });

  const webhookEndpointsTable = schema.table('webhook_endpoints', {
    id: uuid('id').primaryKey().defaultRandom(),
    url: varchar('url', { length: 500 }).notNull(),
    secret: varchar('secret', { length: 200 }).notNull(),
    events: jsonb('events').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  });

  const outboxEventsTable = schema.table('outbox_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastError: varchar('last_error', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  });

  return {
    usersTable,
    customersTable,
    accountsTable,
    transactionsTable,
    ledgerEntriesTable,
    tenantSettingsTable,
    exchangeRatesTable,
    idempotencyRecordsTable,
    auditLogsTable,
    webhookEndpointsTable,
    outboxEventsTable,
  };
}

const tableCache = new Map<string, ReturnType<typeof createTenantTables>>();

export function getTenantTables(schemaName: string) {
  let tables = tableCache.get(schemaName);
  if (!tables) {
    tables = createTenantTables(schemaName);
    tableCache.set(schemaName, tables);
  }
  return tables;
}
