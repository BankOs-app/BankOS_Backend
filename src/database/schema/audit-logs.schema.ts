import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';

export const auditLogsTable = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
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

export type AuditLogRecord = typeof auditLogsTable.$inferSelect;

