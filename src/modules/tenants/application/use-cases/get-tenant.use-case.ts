import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_REPOSITORY } from '../ports/tenant.repository.port';
import type { TenantRepository } from '../ports/tenant.repository.port';
import { TenantResponseDto } from '../dto/tenant-response.dto';

/**
 * Caso de Uso: Consultar Tenant por Slug o Listar todos los Tenants.
 */
@Injectable()
export class GetTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
  ) {}

  async findBySlug(slug: string): Promise<TenantResponseDto> {
    const normalized = slug.trim().toLowerCase();
    const tenant = await this.tenantRepository.findBySlug(normalized);
    if (!tenant) {
      throw new NotFoundException(`No se encontró ningún tenant con el slug '${slug}'`);
    }
    return TenantResponseDto.fromDomain(tenant);
  }

  async findAll(): Promise<TenantResponseDto[]> {
    const tenants = await this.tenantRepository.findAll();
    return tenants.map((tenant) => TenantResponseDto.fromDomain(tenant));
  }
}
