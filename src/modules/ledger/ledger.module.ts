import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LEDGER_REPOSITORY } from './application/ports/ledger.repository.port';
import { DrizzleLedgerRepository } from './infrastructure/persistence/drizzle-ledger.repository';

/**
 * Módulo de Contabilidad y Libro Mayor (Ledger).
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: LEDGER_REPOSITORY,
      useClass: DrizzleLedgerRepository,
    },
  ],
  exports: [LEDGER_REPOSITORY],
})
export class LedgerModule {}
