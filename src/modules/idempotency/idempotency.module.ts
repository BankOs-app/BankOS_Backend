import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IDEMPOTENCY_REPOSITORY } from './application/ports/idempotency.repository.port';
import { DrizzleIdempotencyRepository } from './infrastructure/persistence/drizzle-idempotency.repository';
import { IdempotencyService } from './application/services/idempotency.service';
import { IdempotencyInterceptor } from './presentation/interceptors/idempotency.interceptor';
import { CorrelationIdMiddleware } from './presentation/middleware/correlation-id.middleware';

/**
 * Módulo de Idempotencia y Trazabilidad (HU-10).
 *
 * Marcado como @Global para que el Interceptor de Idempotencia y el Middleware
 * de X-Correlation-ID puedan ser inyectados y utilizados en todos los módulos de transacciones.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    IdempotencyService,
    IdempotencyInterceptor,
    CorrelationIdMiddleware,
    {
      provide: IDEMPOTENCY_REPOSITORY,
      useClass: DrizzleIdempotencyRepository,
    },
  ],
  exports: [
    IdempotencyService,
    IdempotencyInterceptor,
    CorrelationIdMiddleware,
    IDEMPOTENCY_REPOSITORY,
  ],
})
export class IdempotencyModule {}
