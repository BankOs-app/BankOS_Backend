import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';

/**
 * Tabla central de registros de idempotencia.
 *
 * Garantiza a nivel de base de datos la unicidad por (tenant_id, user_id, idempotency_key).
 */
export const idempotencyRecordsTable = pgTable(
  'idempotency_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 100 }).notNull(),
    key: varchar('idempotency_key', { length: 100 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PROCESSING'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    tenantUserKeyIdx: uniqueIndex('idempotency_tenant_user_key_idx').on(
      table.tenantId,
      table.userId,
      table.key,
    ),
  }),
);

export type IdempotencyRecordDb = typeof idempotencyRecordsTable.$inferSelect;

