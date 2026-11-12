import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

