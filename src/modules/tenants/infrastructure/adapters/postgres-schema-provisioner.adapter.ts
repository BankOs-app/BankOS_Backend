import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../../database/database.module';
import { SchemaProvisioner } from '../../application/ports/schema-provisioner.port';

/**
 * Adaptador de infraestructura para aprovisionar esquemas PostgreSQL independientes (Schema-per-Tenant).
 *
 * Cada tenant posee su propio esquema aislado con sus propias tablas físicas:
 * - users
 * - customers
 * - accounts
 * - transactions
 * - ledger_entries
 * - tenant_settings
 * - tenant_exchange_rates
 * - idempotency_records
 * - audit_logs
 * - webhook_endpoints
 * - outbox_events
 */
@Injectable()
export class PostgresSchemaProvisionerAdapter implements SchemaProvisioner {
  private readonly logger = new Logger(PostgresSchemaProvisionerAdapter.name);
  private static readonly SAFE_SCHEMA_REGEX = /^tenant_[a-z0-9_]{3,50}$/;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async provisionSchema(schemaName: string): Promise<void> {
    // 1. Validación estricta contra inyección SQL (Criterio CA-HU-01-03)
    if (!PostgresSchemaProvisionerAdapter.SAFE_SCHEMA_REGEX.test(schemaName)) {
      throw new Error(
        `Nombre de esquema no permitido o potencialmente inseguro: '${schemaName}'`,
      );
    }

    this.logger.log(`Aprovisionando nuevo esquema aislado con sus tablas: ${schemaName}`);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Crear el esquema aislado
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // 3. Crear todas las tablas físicas dentro del esquema del tenant
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".users (
          id UUID PRIMARY KEY,
          email VARCHAR(150) NOT NULL UNIQUE,
          role VARCHAR(20) NOT NULL DEFAULT 'customer',
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          password_hash VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".customers (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES "${schemaName}".users(id) ON DELETE CASCADE UNIQUE,
          full_name VARCHAR(150) NOT NULL,
          document_number VARCHAR(50) NOT NULL UNIQUE,
          email VARCHAR(150) NOT NULL,
          phone VARCHAR(30),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".accounts (
          id UUID PRIMARY KEY,
          customer_id UUID NOT NULL REFERENCES "${schemaName}".users(id) ON DELETE RESTRICT,
          account_number VARCHAR(30) NOT NULL UNIQUE,
          currency VARCHAR(3) NOT NULL,
          balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
          id UUID PRIMARY KEY,
          type VARCHAR(20) NOT NULL,
          source_account_id UUID REFERENCES "${schemaName}".accounts(id) ON DELETE SET NULL,
          destination_account_id UUID REFERENCES "${schemaName}".accounts(id) ON DELETE CASCADE,
          original_amount NUMERIC(18, 2) NOT NULL,
          original_currency VARCHAR(3) NOT NULL,
          converted_amount NUMERIC(18, 2),
          destination_currency VARCHAR(3),
          exchange_rate_applied NUMERIC(18, 6),
          fee_amount NUMERIC(18, 4),
          status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
          idempotency_key VARCHAR(100) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".ledger_entries (
          id UUID PRIMARY KEY,
          transaction_id UUID NOT NULL REFERENCES "${schemaName}".transactions(id) ON DELETE CASCADE,
          account_id UUID NOT NULL REFERENCES "${schemaName}".accounts(id) ON DELETE CASCADE,
          type VARCHAR(20) NOT NULL,
          amount NUMERIC(18, 2) NOT NULL,
          currency VARCHAR(3) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".tenant_settings (
          id UUID PRIMARY KEY,
          primary_currency VARCHAR(3) NOT NULL DEFAULT 'COP',
          max_transaction_amount NUMERIC(18, 2) NOT NULL DEFAULT 10000000.00,
          fee_type VARCHAR(10) NOT NULL DEFAULT 'FIXED',
          fee_value NUMERIC(18, 4) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".tenant_exchange_rates (
          id UUID PRIMARY KEY,
          from_currency VARCHAR(3) NOT NULL,
          to_currency VARCHAR(3) NOT NULL,
          rate NUMERIC(18, 6) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".idempotency_records (
          id UUID PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          idempotency_key VARCHAR(100) NOT NULL,
          request_hash VARCHAR(64) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
          response_code INTEGER,
          response_body JSONB,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".audit_logs (
          id UUID PRIMARY KEY,
          actor_id VARCHAR(100) NOT NULL,
          action VARCHAR(50) NOT NULL,
          resource VARCHAR(50) NOT NULL,
          resource_id VARCHAR(100) NOT NULL,
          previous_values JSONB,
          new_values JSONB,
          correlation_id VARCHAR(100),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".webhook_endpoints (
          id UUID PRIMARY KEY,
          url VARCHAR(500) NOT NULL,
          secret VARCHAR(200) NOT NULL,
          events JSONB NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS "${schemaName}".outbox_events (
          id UUID PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          payload JSONB NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          next_retry_at TIMESTAMPTZ,
          last_error VARCHAR(1000),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 4. Confirmar transacción
      await client.query('COMMIT');
      this.logger.log(`Esquema '${schemaName}' y sus 11 tablas aprovisionadas exitosamente.`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Error durante el aprovisionamiento del esquema '${schemaName}'`,
        error,
      );
      throw error;
    } finally {
      client.release();
    }
  }
}
