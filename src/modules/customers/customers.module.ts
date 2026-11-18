import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CUSTOMER_REPOSITORY } from './application/ports/customer.repository.port';
import { DrizzleCustomerRepository } from './infrastructure/persistence/drizzle-customer.repository';
import { CreateCustomerUseCase } from './application/use-cases/create-customer.use-case';
import { GetCustomerUseCase } from './application/use-cases/get-customer.use-case';
import { CustomersController } from './presentation/controllers/customers.controller';

/**
 * Módulo de Clientes (HU-04).
 */
@Module({
  imports: [DatabaseModule, TenantsModule],
  controllers: [CustomersController],
  providers: [
    CreateCustomerUseCase,
    GetCustomerUseCase,
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: DrizzleCustomerRepository,
    },
  ],
  exports: [
    CUSTOMER_REPOSITORY,
    CreateCustomerUseCase,
    GetCustomerUseCase,
  ],
})
export class CustomersModule {}
