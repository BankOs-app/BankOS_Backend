import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { USER_REPOSITORY } from './application/ports/user.repository.port';
import { DrizzleUserRepository } from './infrastructure/persistence/drizzle-user.repository';
import { BlockUserUseCase } from './application/use-cases/block-user.use-case';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';
import { TenantMatchGuard } from './presentation/guards/tenant-match.guard';
import { AuthController } from './presentation/controllers/auth.controller';

/**
 * Módulo de Identidad y Acceso (HU-03 y HU-04).
 */
@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    JwtTokenService,
    JwtAuthGuard,
    RolesGuard,
    TenantMatchGuard,
    BlockUserUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: DrizzleUserRepository,
    },
  ],
  exports: [
    JwtTokenService,
    JwtAuthGuard,
    RolesGuard,
    TenantMatchGuard,
    USER_REPOSITORY,
    BlockUserUseCase,
  ],
})
export class IdentityModule {}
