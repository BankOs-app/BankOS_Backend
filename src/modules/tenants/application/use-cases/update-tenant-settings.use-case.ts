import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../ports/tenant.repository.port';
import type { TenantRepository } from '../ports/tenant.repository.port';
import { TENANT_SETTINGS_REPOSITORY } from '../ports/tenant-settings.repository.port';
import type { TenantSettingsRepository } from '../ports/tenant-settings.repository.port';
import { TenantSettings } from '../../domain/entities/tenant-settings.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';
import { TenantSettingsResponseDto } from '../dto/tenant-settings-response.dto';
import { RecordAuditLogUseCase } from '../../../audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../audit/domain/value-objects/audit-action.enum';

export interface UpdateTenantSettingsInput {
  slug: string;
  primaryCurrency: Currency;
  maxTransactionAmount: string;
  feeType: FeeType;
  feeValue: string;
  actorId?: string;
  correlationId?: string;
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
    @Optional()
    private readonly recordAuditLogUseCase?: RecordAuditLogUseCase,
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

    const previousValues = {
      primaryCurrency: settings.getPrimaryCurrency(),
      maxTransactionAmount: settings.getMaxTransactionAmount(),
      feeType: settings.getFeeType(),
      feeValue: settings.getFeeValue(),
    };

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

    if (this.recordAuditLogUseCase) {
      await this.recordAuditLogUseCase
        .execute({
          tenantId: tenant.getId(),
          actorId: input.actorId || 'admin',
          action: AuditAction.UPDATE_SETTINGS,
          resource: 'tenant_settings',
          resourceId: settings.getId(),
          previousValues,
          newValues: {
            primaryCurrency: settings.getPrimaryCurrency(),
            maxTransactionAmount: settings.getMaxTransactionAmount(),
            feeType: settings.getFeeType(),
            feeValue: settings.getFeeValue(),
          },
          correlationId: input.correlationId,
        })
        .catch(() => {});
    }

    return TenantSettingsResponseDto.fromDomain(settings);
  }
}

