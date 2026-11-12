import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { ACCOUNT_REPOSITORY } from '../ports/account.repository.port';
import type { AccountRepository } from '../ports/account.repository.port';
import { AccountResponseDto } from '../dto/account-response.dto';

@Injectable()
export class GetAccountUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
  ) {}

  async findByNumber(
    tenantSlug: string,
    accountNumber: string,
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

    return AccountResponseDto.fromDomain(account);
  }

  async listByCustomer(
    tenantSlug: string,
    customerId: string,
  ): Promise<AccountResponseDto[]> {
    const tenant = await this.tenantRepository.findBySlug(
      tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${tenantSlug}'`);
    }

    const accounts = await this.accountRepository.listByCustomer(customerId);
    // Filtrar para asegurar que pertenezcan al tenant resuelto
    const tenantAccounts = accounts.filter(
      (a) => a.getTenantId() === tenant.getId(),
    );

    return tenantAccounts.map((a) => AccountResponseDto.fromDomain(a));
  }

  async listAll(tenantSlug: string): Promise<AccountResponseDto[]> {
    const tenant = await this.tenantRepository.findBySlug(
      tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${tenantSlug}'`);
    }

    const accounts = await this.accountRepository.listByTenant(tenant.getId());
    return accounts.map((a) => AccountResponseDto.fromDomain(a));
  }
}

