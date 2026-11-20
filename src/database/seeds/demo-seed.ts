import { Pool } from 'pg';
import { randomBytes, scryptSync } from 'node:crypto';

function hashPin(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain.trim(), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function migrateCrossTenantTransferSchema(pool: Pool): Promise<void> {
  const { rows } = await pool.query(
    `SELECT schema_name FROM public.tenants WHERE status = 'ACTIVE'`,
  );

  for (const row of rows) {
    const schemaName = String(row.schema_name);
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) continue;
    const table = await pool.query(
      'SELECT to_regclass($1) IS NOT NULL AS exists',
      [`${schemaName}.transactions`],
    );
    if (!table.rows[0]?.exists) continue;

    await pool.query(`
      ALTER TABLE "${schemaName}".transactions
        ADD COLUMN IF NOT EXISTS source_tenant_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS destination_tenant_id VARCHAR(100);
    `);

    const foreignKeys = await pool.query(
      `SELECT c.conname
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = $1 AND t.relname = 'transactions' AND c.contype = 'f'
         AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (destination_account_id)%'`,
      [schemaName],
    );
    for (const foreignKey of foreignKeys.rows) {
      const constraintName = String(foreignKey.conname).replace(/"/g, '""');
      await pool.query(
        `ALTER TABLE "${schemaName}".transactions DROP CONSTRAINT "${constraintName}"`,
      );
    }

    await pool.query(
      `UPDATE "${schemaName}".transactions
       SET source_tenant_id = COALESCE(source_tenant_id, $1),
           destination_tenant_id = COALESCE(destination_tenant_id, $1)
       WHERE source_tenant_id IS NULL OR destination_tenant_id IS NULL`,
      [row.id],
    );
  }
}

/**
 * Script de Datos Semilla para Demostración Oficial de BankOS (Schema-per-Tenant Completo).
 *
 * Configura:
 * - Tabla central public.tenants con parámetros financieros completos (moneda, límites, comisiones).
 * - Esquemas físicos independientes con sus 11 tablas para TODOS los bancos:
 *   1. tenant_banco_bogota
 *   2. tenant_banco_santander
 *   3. tenant_banco_lombia
 *   4. tenant_banco_nu
 */
export async function runSeed(existingPool?: Pool) {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/bankos_db';

  const shouldClose = !existingPool;
  const pool = existingPool ?? new Pool({ connectionString });
  if (shouldClose) {
    console.log(`[Seed] Conectando a PostgreSQL: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
  }

  try {
    // 1. Configurar tabla central public.tenants con columnas financieras
    console.log('[Seed] 1. Configurando tabla central public.tenants...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'PROVISIONING',
        schema_name VARCHAR(63) NOT NULL UNIQUE,
        primary_currency VARCHAR(3) NOT NULL DEFAULT 'COP',
        max_transaction_amount NUMERIC(18, 2) NOT NULL DEFAULT 50000000.00,
        fee_type VARCHAR(20) NOT NULL DEFAULT 'FIXED',
        fee_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
        primary_color VARCHAR(20) NOT NULL DEFAULT '#0A2540',
        accent_color VARCHAR(20) NOT NULL DEFAULT '#0052FF',
        logo_url VARCHAR(255) NOT NULL DEFAULT 'bankos',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_currency VARCHAR(3) NOT NULL DEFAULT 'COP';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_transaction_amount NUMERIC(18, 2) NOT NULL DEFAULT 50000000.00;
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20) NOT NULL DEFAULT 'FIXED';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS fee_value NUMERIC(18, 4) NOT NULL DEFAULT 0.0000;
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) NOT NULL DEFAULT '#0A2540';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) NOT NULL DEFAULT '#0052FF';
      ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255) NOT NULL DEFAULT 'bankos';

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

    // 2. Sembrar los 4 Tenants en public.tenants
    console.log('[Seed] 2. Sembrando catálogo central de Tenants con configuración completa...');
    const tenantBogotaId = '11111111-1111-4111-8111-111111111111';
    const tenantSantanderId = '22222222-2222-4222-8222-222222222222';
    const tenantLombiaId = '4f2a0415-2697-42d7-878d-ab67a1f6a657';
    const tenantNuId = '47130a5f-3368-4a0b-ab77-0982b6a07a96';

    await pool.query(`
      INSERT INTO public.tenants (id, name, slug, status, schema_name, primary_currency, max_transaction_amount, fee_type, fee_value, primary_color, accent_color, logo_url)
      VALUES 
        ('${tenantBogotaId}', 'Banco de Bogotá', 'banco-bogota', 'ACTIVE', 'tenant_banco_bogota', 'COP', 50000000.00, 'FIXED', 2500.0000, '#002D72', '#004BB1', 'banco-bogota'),
        ('${tenantSantanderId}', 'Banco Santander', 'banco-santander', 'ACTIVE', 'tenant_banco_santander', 'USD', 10000.00, 'PERCENTAGE', 1.5000, '#EC0000', '#CC0000', 'banco-santander'),
        ('${tenantLombiaId}', 'Bancolombia', 'banco-lombia', 'ACTIVE', 'tenant_banco_lombia', 'COP', 50000000.00, 'FIXED', 2500.0000, '#000000', '#FDDA24', 'bancolombia'),
        ('${tenantNuId}', 'Banco de NU', 'banco-nu', 'ACTIVE', 'tenant_banco_nu', 'COP', 20000000.00, 'FIXED', 0.0000, '#820AD1', '#9B3FE6', 'banco-nu')
      ON CONFLICT (slug) DO UPDATE SET 
        status = 'ACTIVE',
        primary_currency = EXCLUDED.primary_currency,
        max_transaction_amount = EXCLUDED.max_transaction_amount,
        fee_type = EXCLUDED.fee_type,
        fee_value = EXCLUDED.fee_value,
        primary_color = EXCLUDED.primary_color,
        accent_color = EXCLUDED.accent_color,
        logo_url = EXCLUDED.logo_url;
    `);

    // Función auxiliar para aprovisionar las 11 tablas en un esquema
    const createSchemaTables = async (schemaName: string) => {
      console.log(`[Seed] Aprovisionando 11 tablas en esquema físico '${schemaName}'...`);
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
          destination_account_id UUID,
          source_tenant_id VARCHAR(100),
          destination_tenant_id VARCHAR(100),
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
          primary_color VARCHAR(20) NOT NULL DEFAULT '#0A2540',
          accent_color VARCHAR(20) NOT NULL DEFAULT '#0052FF',
          logo_url VARCHAR(255) NOT NULL DEFAULT 'bankos',
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

    // 3. Crear tablas en los 4 esquemas
    await createSchemaTables('tenant_banco_bogota');
    await createSchemaTables('tenant_banco_santander');
    await createSchemaTables('tenant_banco_lombia');
    await createSchemaTables('tenant_banco_nu');
    await migrateCrossTenantTransferSchema(pool);

    const defaultPasswordHash = hashPin('1234');

    // 4. Sembrar Banco de Bogotá
    console.log('[Seed] 4. Sembrando datos en tenant_banco_bogota...');
    const adminBogotaId = '33333333-3333-4333-8333-333333333333';
    const userCarlosId = '55555555-5555-4555-8555-555555555555';
    const userMariaId = '66666666-6666-4666-8666-666666666666';

    await pool.query(`
      INSERT INTO "tenant_banco_bogota".tenant_settings (id, primary_currency, max_transaction_amount, fee_type, fee_value, primary_color, accent_color, logo_url)
      VALUES (gen_random_uuid(), 'COP', '50000000.00', 'FIXED', '2500.00', '#002D72', '#004BB1', 'banco-bogota')
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

    // 5. Sembrar Banco Santander
    console.log('[Seed] 5. Sembrando datos en tenant_banco_santander...');
    const adminSantanderId = '44444444-4444-4444-8444-444444444444';
    const userJohnId = '77777777-7777-4777-8777-777777777777';

    await pool.query(`
      INSERT INTO "tenant_banco_santander".tenant_settings (id, primary_currency, max_transaction_amount, fee_type, fee_value, primary_color, accent_color, logo_url)
      VALUES (gen_random_uuid(), 'USD', '10000.00', 'PERCENTAGE', '1.50', '#EC0000', '#CC0000', 'banco-santander')
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

    // 6. Sembrar Bancolombia
    console.log('[Seed] 6. Sembrando datos en tenant_banco_lombia...');
    const adminLombiaId = '55551111-5555-4555-8555-555511111111';
    const adminBankosId = '55553333-5555-4555-8555-555533333333';
    const userLombiaId = '55552222-5555-4555-8555-555522222222';

    await pool.query(`
      INSERT INTO "tenant_banco_lombia".tenant_settings (id, primary_currency, max_transaction_amount, fee_type, fee_value, primary_color, accent_color, logo_url)
      VALUES (gen_random_uuid(), 'COP', '50000000.00', 'FIXED', '2500.00', '#000000', '#FDDA24', 'bancolombia')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_lombia".tenant_exchange_rates (id, from_currency, to_currency, rate)
      VALUES 
        (gen_random_uuid(), 'USD', 'COP', '4050.000000'),
        (gen_random_uuid(), 'EUR', 'COP', '4350.000000')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_lombia".users (id, email, role, status, password_hash)
      VALUES 
        ('${adminLombiaId}', 'admin@bancolombia.com', 'admin', 'ACTIVE', '${defaultPasswordHash}'),
        ('${adminBankosId}', 'admin@bankos.com', 'super_admin', 'ACTIVE', '${defaultPasswordHash}'),
        ('${userLombiaId}', 'cliente@bancolombia.com', 'customer', 'ACTIVE', '${defaultPasswordHash}')
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;

      INSERT INTO "tenant_banco_lombia".customers (id, user_id, full_name, document_number, email, phone)
      VALUES 
        (gen_random_uuid(), '${userLombiaId}', 'Alejandro Morales', '7007007007', 'cliente@bancolombia.com', '+573017654321')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_lombia".accounts (id, customer_id, account_number, currency, balance, status)
      VALUES 
        (gen_random_uuid(), '${userLombiaId}', '7007007001', 'COP', '8000000.00', 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `);

    // 7. Sembrar Banco de NU
    console.log('[Seed] 7. Sembrando datos en tenant_banco_nu...');
    const adminNuId = '66661111-6666-4666-8666-666611111111';
    const userNuId = '66662222-6666-4666-8666-666622222222';

    await pool.query(`
      INSERT INTO "tenant_banco_nu".tenant_settings (id, primary_currency, max_transaction_amount, fee_type, fee_value, primary_color, accent_color, logo_url)
      VALUES (gen_random_uuid(), 'COP', '20000000.00', 'FIXED', '0.00', '#820AD1', '#9B3FE6', 'banco-nu')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_nu".users (id, email, role, status, password_hash)
      VALUES 
        ('${adminNuId}', 'admin@nu.com', 'admin', 'ACTIVE', '${defaultPasswordHash}'),
        ('${userNuId}', 'cliente@nu.com', 'customer', 'ACTIVE', '${defaultPasswordHash}')
      ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

      INSERT INTO "tenant_banco_nu".customers (id, user_id, full_name, document_number, email, phone)
      VALUES 
        (gen_random_uuid(), '${userNuId}', 'Catalina Restrepo', '8008008008', 'cliente@nu.com', '+573159988776')
      ON CONFLICT DO NOTHING;

      INSERT INTO "tenant_banco_nu".accounts (id, customer_id, account_number, currency, balance, status)
      VALUES 
        (gen_random_uuid(), '${userNuId}', '8008008001', 'COP', '3500000.00', 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `);

    console.log('\n======================================================');
    console.log('[Seed] Aprovisionamiento Schema-per-Tenant completado exitosamente.');
    console.log('======================================================');
    console.log('Instituciones configuradas en public.tenants con parámetros financieros:');
    console.log('  1. Banco de Bogotá   (banco-bogota)   -> Moneda: COP, Límite: $50M, Comisión: $2,500 COP');
    console.log('  2. Banco Santander   (banco-santander) -> Moneda: USD, Límite: $10k, Comisión: 1.5%');
    console.log('  3. Bancolombia       (banco-lombia)   -> Moneda: COP, Límite: $50M, Comisión: $2,500 COP');
    console.log('  4. Banco de NU       (banco-nu)       -> Moneda: COP, Límite: $20M, Comisión: $0');
    console.log('Esquemas físicos aprovisionados (cada uno con 11 tablas):');
    console.log('  - tenant_banco_bogota');
    console.log('  - tenant_banco_santander');
    console.log('  - tenant_banco_lombia');
    console.log('  - tenant_banco_nu');
    console.log('PIN universal de acceso: 1234');
    console.log('======================================================\n');
  } catch (error) {
    console.error('[Seed] Error durante la ejecución del seed:', error);
  } finally {
    if (shouldClose) {
      await pool.end();
    }
  }
}

export async function autoSeedIfEmpty() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/bankos_db';

  const pool = new Pool({ connectionString });
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tenants'
      );
    `);
    if (tableCheck.rows[0]?.exists) {
      const countCheck = await pool.query(
        'SELECT COUNT(*) as count FROM public.tenants',
      );
      if (parseInt(countCheck.rows[0]?.count ?? '0', 10) > 0) {
        await migrateCrossTenantTransferSchema(pool);
        await pool.query(`
          UPDATE "tenant_banco_lombia".users
          SET role = 'super_admin', updated_at = NOW()
          WHERE email = 'admin@bankos.com' AND role <> 'super_admin';
        `);
        return;
      }
    }
    console.log(
      '[AutoSeed] Base de datos vacía o sin tenants. Sembrando esquemas y datos iniciales para demostración...',
    );
    await runSeed(pool);
  } catch (error) {
    console.warn(
      '[AutoSeed] No se pudo verificar o sembrar la base de datos:',
      error,
    );
  } finally {
    await pool.end().catch(() => {});
  }
}

const isDirectExecution =
  process.argv[1]?.endsWith('demo-seed.ts') ||
  process.argv[1]?.endsWith('demo-seed.js');
if (isDirectExecution) {
  void runSeed();
}
