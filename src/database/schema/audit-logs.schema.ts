import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';

/**
 * Tabla de Auditoría Inmutable (`audit_logs`) - HU-14.
 *
 * Registra de manera indeleble todas las acciones administrativas sensibles ejecutadas en el sistema:
 * - Creación de clientes, apertura de cuentas, cambios de tasas de cambio o reglas financieras.
 * - Registra el actor (`actorId`), la acción (`action`), el recurso afectado (`resource` y `resourceId`),
 *   el estado previo (`previousValues`), el estado nuevo (`newValues`) y el `correlationId`.
 *
 * NOTA DE SEGURIDAD CRÍTICA:
 * Esta tabla cuenta con reglas SQL en PostgreSQL (`audit_logs_no_update` y `audit_logs_no_delete`)
 * que bloquean incondicionalmente cualquier sentencia UPDATE o DELETE, garantizando una bitácora WORM
 * (Write Once, Read Many) a prueba de manipulaciones internas.
 */
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


