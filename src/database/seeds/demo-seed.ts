import { Pool } from 'pg';

/**
 * Script de Datos Semilla para Demostración Oficial de BankOS (HU-16 - T03).
 *
 * Configura de forma reproducible:
 * - 2 Tenants aislados (Banco de Bogotá y Banco Santander) con sus esquemas PostgreSQL.
 * - Reglas financieras y tasas de cambio para conversiones multimoneda.
 * - Usuarios (administradores y clientes) vinculados a sus tenants.
 * - Cuentas bancarias en COP y USD con saldos preparados para las demos en vivo.
 */
async function runSeed() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/bankos_db';

  console.log(`[Seed] Conectando a PostgreSQL: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
  const pool = new Pool({ connectionString });

  try {
    // 1. Crear esquemas y tablas si no existen
    console.log('[Seed] 1. Inicializando tablas base en PostgreSQL...');
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

      CREATE TABLE IF NOT EXISTS public.tenant_settings (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        primary_currency VARCHAR(3) NOT NULL DEFAULT 'COP',
        max_transaction_amount NUMERIC(18, 2) NOT NULL DEFAULT '10000000.00',
        fee_type VARCHAR(10) NOT NULL DEFAULT 'FIXED',
        fee_value NUMERIC(18, 4) NOT NULL DEFAULT '0.00',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.tenant_exchange_rates (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        from_currency VARCHAR(3) NOT NULL,
        to_currency VARCHAR(3) NOT NULL,
        rate NUMERIC(18, 6) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        email VARCHAR(150) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'customer',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.customers (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        full_name VARCHAR(150) NOT NULL,
        document_number VARCHAR(30) NOT NULL,
        email VARCHAR(150) NOT NULL,
        phone VARCHAR(30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.accounts (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
        account_number VARCHAR(30) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        balance NUMERIC(18, 2) NOT NULL DEFAULT '0.00',
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.transactions (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        source_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
        destination_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
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

      CREATE TABLE IF NOT EXISTS public.ledger_entries (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        amount NUMERIC(18, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.idempotency_records (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        user_id VARCHAR(100) NOT NULL,
        idempotency_key VARCHAR(100) NOT NULL,
        request_hash VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
        response_code INTEGER,
        response_body JSONB,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        actor_id VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        resource VARCHAR(50) NOT NULL,
        resource_id VARCHAR(100) NOT NULL,
        previous_values JSONB,
        new_values JSONB,
        correlation_id VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        url VARCHAR(500) NOT NULL,
        secret VARCHAR(200) NOT NULL,
        events JSONB NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.outbox_events (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
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

    // 2. Sembrar Tenants
    console.log('[Seed] 2. Sembrando Tenants de prueba...');
    const tenant1Id = '11111111-1111-4111-8111-111111111111';
    const tenant2Id = '22222222-2222-4222-8222-222222222222';

    await pool.query(`
      INSERT INTO public.tenants (id, name, slug, status, schema_name)
      VALUES 
        ('${tenant1Id}', 'Banco de Bogotá', 'banco-bogota', 'ACTIVE', 'tenant_banco_bogota'),
        ('${tenant2Id}', 'Banco Santander', 'banco-santander', 'ACTIVE', 'tenant_banco_santander')
      ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE';

      CREATE SCHEMA IF NOT EXISTS "tenant_banco_bogota";
      CREATE SCHEMA IF NOT EXISTS "tenant_banco_santander";
    `);

    // 3. Sembrar Configuración Financiera
    console.log('[Seed] 3. Sembrando Reglas Financieras y Tasas de Cambio...');
    await pool.query(`
      INSERT INTO public.tenant_settings (id, tenant_id, primary_currency, max_transaction_amount, fee_type, fee_value)
      VALUES 
        (gen_random_uuid(), '${tenant1Id}', 'COP', '50000000.00', 'FIXED', '2500.00'),
        (gen_random_uuid(), '${tenant2Id}', 'USD', '10000.00', 'PERCENTAGE', '1.50')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.tenant_exchange_rates (id, tenant_id, from_currency, to_currency, rate)
      VALUES 
        (gen_random_uuid(), '${tenant1Id}', 'USD', 'COP', '4000.000000'),
        (gen_random_uuid(), '${tenant1Id}', 'EUR', 'COP', '4300.000000'),
        (gen_random_uuid(), '${tenant2Id}', 'EUR', 'USD', '1.080000'),
        (gen_random_uuid(), '${tenant2Id}', 'COP', 'USD', '0.000250')
      ON CONFLICT DO NOTHING;
    `);

    // 4. Sembrar Usuarios
    console.log('[Seed] 4. Sembrando Usuarios y Clientes...');
    const adminBogotaId = '33333333-3333-4333-8333-333333333333';
    const adminSantanderId = '44444444-4444-4444-8444-444444444444';
    const userCarlosId = '55555555-5555-4555-8555-555555555555';
    const userMariaId = '66666666-6666-4666-8666-666666666666';
    const userJohnId = '77777777-7777-4777-8777-777777777777';

    await pool.query(`
      INSERT INTO public.users (id, tenant_id, email, role, status)
      VALUES 
        ('${adminBogotaId}', '${tenant1Id}', 'admin@bogota.com', 'admin', 'ACTIVE'),
        ('${adminSantanderId}', '${tenant2Id}', 'admin@santander.com', 'admin', 'ACTIVE'),
        ('${userCarlosId}', '${tenant1Id}', 'carlos@bogota.com', 'customer', 'ACTIVE'),
        ('${userMariaId}', '${tenant1Id}', 'maria@bogota.com', 'customer', 'ACTIVE'),
        ('${userJohnId}', '${tenant2Id}', 'john@santander.com', 'customer', 'ACTIVE')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.customers (id, user_id, tenant_id, full_name, document_number, email, phone)
      VALUES 
        (gen_random_uuid(), '${userCarlosId}', '${tenant1Id}', 'Carlos Gómez', '1001001001', 'carlos@bogota.com', '+573001234567'),
        (gen_random_uuid(), '${userMariaId}', '${tenant1Id}', 'María Rodríguez', '2002002002', 'maria@bogota.com', '+573109876543'),
        (gen_random_uuid(), '${userJohnId}', '${tenant2Id}', 'John Smith', '9009009009', 'john@santander.com', '+15551234567')
      ON CONFLICT DO NOTHING;
    `);

    // 5. Sembrar Cuentas Bancarias
    console.log('[Seed] 5. Sembrando Cuentas Bancarias con saldos iniciales...');
    await pool.query(`
      INSERT INTO public.accounts (id, tenant_id, customer_id, account_number, currency, balance, status)
      VALUES 
        ('88888888-8888-4888-8888-888888888881', '${tenant1Id}', '${userCarlosId}', '1001001001', 'COP', '5000000.00', 'ACTIVE'),
        ('88888888-8888-4888-8888-888888888882', '${tenant1Id}', '${userCarlosId}', '1001001002', 'USD', '1500.00', 'ACTIVE'),
        ('88888888-8888-4888-8888-888888888883', '${tenant1Id}', '${userMariaId}', '2002002001', 'COP', '250000.00', 'ACTIVE'),
        ('88888888-8888-4888-8888-888888888884', '${tenant2Id}', '${userJohnId}', '9009009001', 'USD', '3500.00', 'ACTIVE')
      ON CONFLICT DO NOTHING;
    `);

    console.log('\n======================================================');
    console.log('✅ SEED COMPLETADO EXITOSAMENTE PARA LA DEMOSTRACIÓN');
    console.log('======================================================');
    console.log('Instituciones creadas:');
    console.log('  1. Banco de Bogotá   (slug: banco-bogota)');
    console.log('     - Admin: admin@bogota.com');
    console.log('     - Cliente Carlos: cuenta COP 1001001001 ($5,000,000 COP), cuenta USD 1001001002 ($1,500 USD)');
    console.log('     - Cliente María:  cuenta COP 2002002001 ($250,000 COP)');
    console.log('     - Tasa de Cambio: 1 USD = 4,000 COP | Comisión Fija: $2,500 COP');
    console.log('  2. Banco Santander   (slug: banco-santander)');
    console.log('     - Admin: admin@santander.com');
    console.log('     - Cliente John:   cuenta USD 9009009001 ($3,500 USD)');
    console.log('     - Comisión Porcentual: 1.5%');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed:', error);
  } finally {
    await pool.end();
  }
}

void runSeed();
