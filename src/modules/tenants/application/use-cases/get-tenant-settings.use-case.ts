import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_REPOSITORY } from '../ports/tenant.repository.port';
import type { TenantRepository } from '../ports/tenant.repository.port';
import { TENANT_SETTINGS_REPOSITORY } from '../ports/tenant-settings.repository.port';
import type { TenantSettingsRepository } from '../ports/tenant-settings.repository.port';
import { TenantSettings } from '../../domain/entities/tenant-settings.entity';
import { TenantSettingsResponseDto } from '../dto/tenant-settings-response.dto';

/**
 * Caso de Uso: Consultar la Configuración Financiera de un Tenant.
 */
@Injectable()
export class GetTenantSettingsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(TENANT_SETTINGS_REPOSITORY)
    private readonly settingsRepository: TenantSettingsRepository,
  ) {}

  async execute(slug: string): Promise<TenantSettingsResponseDto> {
    const tenant = await this.tenantRepository.findBySlug(slug.trim().toLowerCase());
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant con slug '${slug}'`);
    }

    let settings = await this.settingsRepository.findByTenantId(tenant.getId());
    if (!settings) {
      // Si el tenant no tenía configuración personalizada aún, inicializamos la por defecto
      settings = TenantSettings.createDefault(tenant.getId());
      await this.settingsRepository.save(settings);
    }

    return TenantSettingsResponseDto.fromDomain(settings);
  }
}

