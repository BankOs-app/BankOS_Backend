import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 150 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('customer'),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantEmailIdx: uniqueIndex('users_tenant_email_idx').on(
      table.tenantId,
      table.email,
    ),
  }),
);

export type UserRecord = typeof usersTable.$inferSelect;

export const customersTable = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' })
      .unique(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    documentNumber: varchar('document_number', { length: 50 }).notNull(),
    email: varchar('email', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantDocIdx: uniqueIndex('customers_tenant_doc_idx').on(
      table.tenantId,
      table.documentNumber,
    ),
  }),
);

export type CustomerRecord = typeof customersTable.$inferSelect;

