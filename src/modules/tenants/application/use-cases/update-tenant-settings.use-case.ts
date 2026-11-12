import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../ports/tenant.repository.port';
import type { TenantRepository } from '../ports/tenant.repository.port';
import { TENANT_SETTINGS_REPOSITORY } from '../ports/tenant-settings.repository.port';
import type { TenantSettingsRepository } from '../ports/tenant-settings.repository.port';
import { TenantSettings } from '../../domain/entities/tenant-settings.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';
import { TenantSettingsResponseDto } from '../dto/tenant-settings-response.dto';

export interface UpdateTenantSettingsInput {
  slug: string;
  primaryCurrency: Currency;
  maxTransactionAmount: string;
  feeType: FeeType;
  feeValue: string;
}

/**
 * Caso de Uso: Actualizar Parámetros Financieros del Tenant (HU-02)
 *
 * Valida:
 * - Existencia del tenant.
 * - Monedas admitidas.
 * - Límite máximo positivo (> 0).
 * - Comisión fija no negativa (>= 0).
 * - Comisión porcentual en rango [0, 100].
 */
@Injectable()
export class UpdateTenantSettingsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(TENANT_SETTINGS_REPOSITORY)
    private readonly settingsRepository: TenantSettingsRepository,
  ) {}

  async execute(
    input: UpdateTenantSettingsInput,
  ): Promise<TenantSettingsResponseDto> {
    const tenant = await this.tenantRepository.findBySlug(
      input.slug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant con slug '${input.slug}'`);
    }

    let settings = await this.settingsRepository.findByTenantId(tenant.getId());
    if (!settings) {
      settings = TenantSettings.createDefault(tenant.getId());
      await this.settingsRepository.save(settings);
    }

    try {
      settings.update({
        primaryCurrency: input.primaryCurrency,
        maxTransactionAmount: input.maxTransactionAmount,
        feeType: input.feeType,
        feeValue: input.feeValue,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Parámetros inválidos';
      throw new BadRequestException(message);
    }

    await this.settingsRepository.update(settings);

    return TenantSettingsResponseDto.fromDomain(settings);
  }
}

