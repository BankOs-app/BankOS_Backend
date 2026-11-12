import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AccountsModule } from '../accounts/accounts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TRANSACTION_REPOSITORY } from './application/ports/transaction.repository.port';
import { DrizzleTransactionRepository } from './infrastructure/persistence/drizzle-transaction.repository';
import { DepositUseCase } from './application/use-cases/deposit.use-case';
import { WithdrawUseCase } from './application/use-cases/withdraw.use-case';
import { PreviewTransferUseCase } from './application/use-cases/preview-transfer.use-case';
import { TransferUseCase } from './application/use-cases/transfer.use-case';
import { GetTransactionHistoryUseCase } from './application/use-cases/get-transaction-history.use-case';
import { GetTransactionDetailUseCase } from './application/use-cases/get-transaction-detail.use-case';
import { TransactionsController } from './presentation/controllers/transactions.controller';

/**
 * Módulo de Operaciones Financieras (Épica EP-04: HU-07, HU-08, HU-09, HU-11).
 */
@Module({
  imports: [
    DatabaseModule,
    TenantsModule,
    AccountsModule,
    LedgerModule,
    WebhooksModule,
  ],
  controllers: [TransactionsController],
  providers: [
    DepositUseCase,
    WithdrawUseCase,
    PreviewTransferUseCase,
    TransferUseCase,
    GetTransactionHistoryUseCase,
    GetTransactionDetailUseCase,
    {
      provide: TRANSACTION_REPOSITORY,
      useClass: DrizzleTransactionRepository,
    },
  ],
  exports: [
    TRANSACTION_REPOSITORY,
    DepositUseCase,
    WithdrawUseCase,
    PreviewTransferUseCase,
    TransferUseCase,
    GetTransactionHistoryUseCase,
    GetTransactionDetailUseCase,
  ],
})
export class TransactionsModule {}
