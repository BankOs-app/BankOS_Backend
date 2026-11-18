import { Pool } from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';

function hashPin(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain.trim(), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Script de Datos Semilla para Demostración Oficial de BankOS (Schema-per-Tenant).
 *
 * Configura de forma reproducible:
 * - Tabla central public.tenants (única tabla compartida).
 * - Esquemas físicos independientes: tenant_banco_bogota y tenant_banco_santander.
 * - Cada esquema con sus 11 tablas propias (users, accounts, customers, transactions, etc.) sin columna tenant_id.
 * - Usuarios, cuentas bancarias en COP y USD con saldos listos para la demo.
 */
async function runSeed() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/bankos_db';

  console.log(`[Seed] Conectando a PostgreSQL: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
  const pool = new Pool({ connectionString });

  try {
    // 1. Limpieza de tablas heredadas en public (para que en public solo viva tenants)
    console.log('[Seed] 1. Configurando tabla central public.tenants...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'PROVISIONING',
        schema_name VARCHAR(63) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      DROP TABLE IF EXISTS public.outbox_events CASCADE;
      DROP TABLE IF EXISTS public.webhook_endpoints CASCADE;
      DROP TABLE IF EXISTS public.audit_logs CASCADE;
      DROP TABLE IF EXISTS public.idempotency_records CASCADE;
      DROP TABLE IF EXISTS public.ledger_entries CASCADE;
      DROP TABLE IF EXISTS public.transactions CASCADE;
      DROP TABLE IF EXISTS public.accounts CASCADE;
      DROP TABLE IF EXISTS public.customers CASCADE;
      DROP TABLE IF EXISTS public.users CASCADE;
      DROP TABLE IF EXISTS public.tenant_exchange_rates CASCADE;
      DROP TABLE IF EXISTS public.tenant_settings CASCADE;
    `);

    // 2. Sembrar Tenants
    console.log('[Seed] 2. Sembrando catálogo central de Tenants...');
    const tenant1Id = '11111111-1111-4111-8111-111111111111';
    const tenant2Id = '22222222-2222-4222-8222-222222222222';

    await pool.query(`
      INSERT INTO public.tenants (id, name, slug, status, schema_name)
      VALUES 
        ('${tenant1Id}', 'Banco de Bogotá', 'banco-bogota', 'ACTIVE', 'tenant_banco_bogota'),
        ('${tenant2Id}', 'Banco Santander', 'banco-santander', 'ACTIVE', 'tenant_banco_santander')
      ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE';
    `);

    // Función auxiliar para aprovisionar las 11 tablas en un esquema
    const createSchemaTables = async (schemaName: string) => {
      console.log(`[Seed] Aprovisionando tablas en esquema físico '${schemaName}'...`);
      await pool.query(`
        CREATE SCHEMA IF NOT EXISTS "${schemaName}";

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
    };

    // 3. Crear tablas en cada esquema
    await createSchemaTables('tenant_banco_bogota');
    await createSchemaTables('tenant_banco_santander');

    // 4. Sembrar datos de Banco de Bogotá
    console.log('[Seed] 4. Sembrando datos en tenant_banco_bogota...');
    const defaultPasswordHash = hashPin('1234');

    const adminBogotaId = '33333333-3333-4333-8333-333333333333';
    const userCarlosId = '55555555-5555-4555-8555-555555555555';
    const userMariaId = '66666666-6666-4666-8666-666666666666';

    await pool.query(`
      INSERT INTO "tenant_banco_bogota".tenant_settings (id, primary_currency, max_transaction_amount, fee_type, fee_value)
      VALUES (gen_random_uuid(), 'COP', '50000000.00', 'FIXED', '2500.00')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_bogota".tenant_exchange_rates (id, from_currency, to_currency, rate)
      VALUES 
        (gen_random_uuid(), 'USD', 'COP', '4000.000000'),
        (gen_random_uuid(), 'EUR', 'COP', '4300.000000')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_bogota".users (id, email, role, status, password_hash)
      VALUES 
        ('${adminBogotaId}', 'admin@bogota.com', 'admin', 'ACTIVE', '${defaultPasswordHash}'),
        ('${userCarlosId}', 'carlos@bogota.com', 'customer', 'ACTIVE', '${defaultPasswordHash}'),
        ('${userMariaId}', 'maria@bogota.com', 'customer', 'ACTIVE', '${defaultPasswordHash}')
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

      INSERT INTO "tenant_banco_bogota".customers (id, user_id, full_name, document_number, email, phone)
      VALUES 
        (gen_random_uuid(), '${userCarlosId}', 'Carlos Gómez', '1001001001', 'carlos@bogota.com', '+573001234567'),
        (gen_random_uuid(), '${userMariaId}', 'María Rodríguez', '2002002002', 'maria@bogota.com', '+573109876543')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_bogota".accounts (id, customer_id, account_number, currency, balance, status)
      VALUES 
        ('88888888-8888-4888-8888-888888888881', '${userCarlosId}', '1001001001', 'COP', '5000000.00', 'ACTIVE'),
        ('88888888-8888-4888-8888-888888888882', '${userCarlosId}', '1001001002', 'USD', '1500.00', 'ACTIVE'),
        ('88888888-8888-4888-8888-888888888883', '${userMariaId}', '2002002001', 'COP', '250000.00', 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `);

    // 5. Sembrar datos de Banco Santander
    console.log('[Seed] 5. Sembrando datos en tenant_banco_santander...');
    const adminSantanderId = '44444444-4444-4444-8444-444444444444';
    const userJohnId = '77777777-7777-4777-8777-777777777777';

    await pool.query(`
      INSERT INTO "tenant_banco_santander".tenant_settings (id, primary_currency, max_transaction_amount, fee_type, fee_value)
      VALUES (gen_random_uuid(), 'USD', '10000.00', 'PERCENTAGE', '1.50')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_santander".tenant_exchange_rates (id, from_currency, to_currency, rate)
      VALUES 
        (gen_random_uuid(), 'EUR', 'USD', '1.080000'),
        (gen_random_uuid(), 'COP', 'USD', '0.000250')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_santander".users (id, email, role, status, password_hash)
      VALUES 
        ('${adminSantanderId}', 'admin@santander.com', 'admin', 'ACTIVE', '${defaultPasswordHash}'),
        ('${userJohnId}', 'john@santander.com', 'customer', 'ACTIVE', '${defaultPasswordHash}')
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

      INSERT INTO "tenant_banco_santander".customers (id, user_id, full_name, document_number, email, phone)
      VALUES 
        (gen_random_uuid(), '${userJohnId}', 'John Smith', '9009009009', 'john@santander.com', '+15551234567')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_santander".accounts (id, customer_id, account_number, currency, balance, status)
      VALUES 
        ('88888888-8888-4888-8888-888888888884', '${userJohnId}', '9009009001', 'USD', '3500.00', 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `);

    console.log('\n======================================================');
    console.log('✅ SEED SCHEMA-PER-TENANT COMPLETADO EXITOSAMENTE');
    console.log('======================================================');
    console.log('Esquemas creados físicamente en PostgreSQL:');
    console.log('  - public: solo tabla "tenants"');
    console.log('  - tenant_banco_bogota: 11 tablas con datos de Banco de Bogotá');
    console.log('  - tenant_banco_santander: 11 tablas con datos de Banco Santander');
    console.log('PIN universal de prueba: 1234');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed:', error);
  } finally {
    await pool.end();
  }
}

void runSeed();
