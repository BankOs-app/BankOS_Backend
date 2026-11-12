import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

// Puertos
import { TENANT_REPOSITORY } from './application/ports/tenant.repository.port';
import { SCHEMA_PROVISIONER } from './application/ports/schema-provisioner.port';
import { TENANT_SETTINGS_REPOSITORY } from './application/ports/tenant-settings.repository.port';
import { EXCHANGE_RATE_REPOSITORY } from './application/ports/exchange-rate.repository.port';

// Adaptadores de infraestructura
import { DrizzleTenantRepository } from './infrastructure/persistence/drizzle-tenant.repository';
import { PostgresSchemaProvisionerAdapter } from './infrastructure/adapters/postgres-schema-provisioner.adapter';
import { DrizzleTenantSettingsRepository } from './infrastructure/persistence/drizzle-tenant-settings.repository';
import { DrizzleExchangeRateRepository } from './infrastructure/persistence/drizzle-exchange-rate.repository';

// Casos de uso
import { RegisterTenantUseCase } from './application/use-cases/register-tenant.use-case';
import { GetTenantUseCase } from './application/use-cases/get-tenant.use-case';
import { GetTenantSettingsUseCase } from './application/use-cases/get-tenant-settings.use-case';
import { UpdateTenantSettingsUseCase } from './application/use-cases/update-tenant-settings.use-case';
import { SetExchangeRateUseCase } from './application/use-cases/set-exchange-rate.use-case';
import { GetExchangeRatesUseCase } from './application/use-cases/get-exchange-rates.use-case';

// Controladores
import { TenantsController } from './presentation/controllers/tenants.controller';
import { TenantSettingsController } from './presentation/controllers/tenant-settings.controller';

/**
 * Módulo de Tenants y Configuración (Épica EP-01: HU-01 y HU-02)
 */
@Module({
  imports: [DatabaseModule],
  controllers: [TenantsController, TenantSettingsController],
  providers: [
    RegisterTenantUseCase,
    GetTenantUseCase,
    GetTenantSettingsUseCase,
    UpdateTenantSettingsUseCase,
    SetExchangeRateUseCase,
    GetExchangeRatesUseCase,
    {
      provide: TENANT_REPOSITORY,
      useClass: DrizzleTenantRepository,
    },
    {
      provide: SCHEMA_PROVISIONER,
      useClass: PostgresSchemaProvisionerAdapter,
    },
    {
      provide: TENANT_SETTINGS_REPOSITORY,
      useClass: DrizzleTenantSettingsRepository,
    },
    {
      provide: EXCHANGE_RATE_REPOSITORY,
      useClass: DrizzleExchangeRateRepository,
    },
  ],
  exports: [
    TENANT_REPOSITORY,
    SCHEMA_PROVISIONER,
    TENANT_SETTINGS_REPOSITORY,
    EXCHANGE_RATE_REPOSITORY,
    RegisterTenantUseCase,
    GetTenantUseCase,
    GetTenantSettingsUseCase,
    UpdateTenantSettingsUseCase,
    SetExchangeRateUseCase,
    GetExchangeRatesUseCase,
  ],
})
export class TenantsModule {}
