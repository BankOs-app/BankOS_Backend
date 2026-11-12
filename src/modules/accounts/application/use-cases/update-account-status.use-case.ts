import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { ACCOUNT_REPOSITORY } from '../ports/account.repository.port';
import type { AccountRepository } from '../ports/account.repository.port';
import { AccountStatus } from '../../domain/value-objects/account-status.enum';
import { AccountResponseDto } from '../dto/account-response.dto';

@Injectable()
export class UpdateAccountStatusUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    tenantSlug: string,
    accountNumber: string,
    newStatus: AccountStatus,
  ): Promise<AccountResponseDto> {
    const tenant = await this.tenantRepository.findBySlug(
      tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${tenantSlug}'`);
    }

    const account = await this.accountRepository.findByNumber(
      tenant.getId(),
      accountNumber.trim(),
    );

    if (!account) {
      throw new NotFoundException(
        `Cuenta '${accountNumber}' no encontrada en esta institución.`,
      );
    }

    switch (newStatus) {
      case AccountStatus.ACTIVE:
        account.activate();
        break;
      case AccountStatus.BLOCKED:
        account.block();
        break;
      case AccountStatus.INACTIVE:
        // Borrado lógico (Soft Delete)
        account.deactivate();
        break;
      default:
        throw new BadRequestException('Estado de cuenta no permitido.');
    }

    await this.accountRepository.update(account);

    return AccountResponseDto.fromDomain(account);
  }
}
