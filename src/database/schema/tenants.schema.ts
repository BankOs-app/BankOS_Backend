import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

/**
 * Tabla central de Tenants en el esquema 'public'.
 *
 * Contiene el registro de las instituciones financieras y el nombre
 * del esquema PostgreSQL aislado que le corresponde a cada una.
 */
export const tenantsTable = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  schemaName: varchar('schema_name', { length: 63 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('PROVISIONING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TenantRecord = typeof tenantsTable.$inferSelect;
export type NewTenantRecord = typeof tenantsTable.$inferInsert;

