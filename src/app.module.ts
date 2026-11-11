import { Module } from '@nestjs/common';

import { TenantsModule } from './modules/tenants/tenants.module';
import { IdentityModule } from './modules/identity/identity.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { FeesModule } from './modules/fees/fees.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
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
})
export class AppModule {}