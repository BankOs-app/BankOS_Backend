import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CustomersModule } from '../customers/customers.module';
import { ACCOUNT_REPOSITORY } from './application/ports/account.repository.port';
import { DrizzleAccountRepository } from './infrastructure/persistence/drizzle-account.repository';
import { CreateAccountUseCase } from './application/use-cases/create-account.use-case';
import { GetAccountUseCase } from './application/use-cases/get-account.use-case';
import { UpdateAccountStatusUseCase } from './application/use-cases/update-account-status.use-case';
import { AccountsController } from './presentation/controllers/accounts.controller';

/**
 * Módulo de Cuentas Bancarias (HU-05).
 */
@Module({
  imports: [DatabaseModule, TenantsModule, CustomersModule],
  controllers: [AccountsController],
  providers: [
    CreateAccountUseCase,
    GetAccountUseCase,
    UpdateAccountStatusUseCase,
    {
      provide: ACCOUNT_REPOSITORY,
      useClass: DrizzleAccountRepository,
    },
  ],
  exports: [
    ACCOUNT_REPOSITORY,
    CreateAccountUseCase,
    GetAccountUseCase,
    UpdateAccountStatusUseCase,
  ],
})
export class AccountsModule {}
