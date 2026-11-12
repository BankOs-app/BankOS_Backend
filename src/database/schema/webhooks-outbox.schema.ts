import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { tenantsTable } from './tenants.schema';

/**
 * Tabla de Endpoints de Webhooks suscritos (`webhook_endpoints`) - HU-15.
 *
 * Almacena las URLs que los sistemas externos de cada banco configuran para recibir
 * notificaciones push en tiempo real (por ejemplo, cuando ocurre un depósito o transferencia):
 * - `secret`: Clave compartida utilizada para calcular la firma criptográfica HMAC-SHA256 en la cabecera `X-BankOS-Signature`.
 * - `events`: Lista en formato JSON de los tópicos a los que está suscrito el endpoint (ej. `["transfer.completed"]`).
 */
export const webhookEndpointsTable = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  secret: varchar('secret', { length: 200 }).notNull(),
  events: jsonb('events').notNull(), // Array de eventos suscritos: ['transfer.completed']
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WebhookEndpointRecord = typeof webhookEndpointsTable.$inferSelect;

/**
 * Tabla de Eventos Outbox (`outbox_events`) - Patrón Transactional Outbox.
 *
 * Resuelve el problema fundamental de los sistemas distribuidos de "Dual Write" (escritura doble):
 * Cuando se ejecuta una transacción financiera, en lugar de llamar a una API externa por HTTP directamente
 * (lo cual fallaría si la red se cae después de debitar la cuenta), el evento se inserta en la misma
 * transacción ACID de la base de datos de PostgreSQL con estado 'PENDING'.
 *
 * Un despachador en segundo plano lee los eventos pendientes y los envía con reintentos exponenciales.
 */
export const outboxEventsTable = pgTable('outbox_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenantsTable.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'), // PENDING | DELIVERED | FAILED
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

export type OutboxEventRecord = typeof outboxEventsTable.$inferSelect;


