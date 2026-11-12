import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Módulos de funcionalidades y arquitectura de BankOS
import { TenantsModule } from './modules/tenants/tenants.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { CorrelationIdMiddleware } from './modules/idempotency/presentation/middleware/correlation-id.middleware';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { FeesModule } from './modules/fees/fees.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuditModule } from './modules/audit/audit.module';

/**
 * AppModule — Módulo raíz de la arquitectura modular de NestJS.
 *
 * Agrupa y organiza todos los submódulos de la aplicación bajo principios de alta cohesión
 * y bajo acoplamiento:
 * - `ConfigModule`: Carga variables de entorno (.env) de forma global.
 * - `DatabaseModule`: Provee la conexión central a PostgreSQL y Drizzle ORM.
 * - `TenantsModule`: Gestión de bancos clientes y aprovisionamiento dinámico de esquemas (HU-01, HU-02).
 * - `IdentityModule`: Autenticación OIDC/JWT y control de accesos basado en roles (RBAC) (HU-03).
 * - `CustomersModule`: Administración de clientes y usuarios bancarios (HU-04).
 * - `AccountsModule`: Creación, congelamiento y balance de cuentas bancarias (HU-05).
 * - `TransactionsModule`: Depósitos, retiros y transferencias multimoneda (HU-07, HU-08, HU-09).
 * - `LedgerModule`: Libro contable de doble entrada inmutable para saldos y auditoría financiera.
 * - `IdempotencyModule`: Middleware y decoradores para prevenir pagos duplicados (HU-10).
 * - `WebhooksModule`: Publicación transaccional con Transactional Outbox y firmas HMAC (HU-15).
 * - `AuditModule`: Bitácora inmutable de eventos administrativos con reglas en BD (HU-14).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    TenantsModule,
    IdentityModule,
    CustomersModule,
    AccountsModule,
    TransactionsModule,
    LedgerModule,
    IdempotencyModule,
    ExchangeRatesModule,
    FeesModule,
    WebhooksModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  /**
   * Configuración de middlewares globales HTTP.
   * `CorrelationIdMiddleware`: Inyecta o propaga la cabecera 'X-Correlation-ID' en cada petición entrante
   * para trazabilidad distribuida de logs en producción y auditoría.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}


