import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AUDIT_LOG_REPOSITORY } from './application/ports/audit-log.repository.port';
import { DrizzleAuditLogRepository } from './infrastructure/persistence/drizzle-audit-log.repository';
import { RecordAuditLogUseCase } from './application/use-cases/record-audit-log.use-case';
import { GetAuditLogsUseCase } from './application/use-cases/get-audit-logs.use-case';
import { AuditController } from './presentation/controllers/audit.controller';

/**
 * Módulo de Auditoría Administrativa (Épica EP-05: HU-14).
 * Provee persistencia inmutable de eventos sensibles y consulta para administradores.
 */
@Module({
  imports: [DatabaseModule, TenantsModule],
  controllers: [AuditController],
  providers: [
    RecordAuditLogUseCase,
    GetAuditLogsUseCase,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: DrizzleAuditLogRepository,
    },
  ],
  exports: [
    AUDIT_LOG_REPOSITORY,
    RecordAuditLogUseCase,
    GetAuditLogsUseCase,
  ],
})
export class AuditModule {}
