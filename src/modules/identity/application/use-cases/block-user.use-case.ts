import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { UserRepository } from '../ports/user.repository.port';
import { RecordAuditLogUseCase } from '../../../audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../audit/domain/value-objects/audit-action.enum';

@Injectable()
export class BlockUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Optional()
    private readonly recordAuditLogUseCase?: RecordAuditLogUseCase,
  ) {}

  async execute(userId: string, tenantId: string): Promise<void> {
    const user = await this.userRepository.findById(userId, tenantId);
    if (!user || user.getTenantId() !== tenantId) {
      throw new NotFoundException('Usuario no encontrado en esta institución.');
    }

    user.block();
    await this.userRepository.update(user);

    if (this.recordAuditLogUseCase) {
      await this.recordAuditLogUseCase
        .execute({
          tenantId,
          actorId: 'admin',
          action: AuditAction.BLOCK_USER,
          resource: 'users',
          resourceId: user.getId(),
          newValues: { status: user.getStatus() },
        })
        .catch(() => {});
    }
  }
}

