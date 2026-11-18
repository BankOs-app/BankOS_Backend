import { TenantSettings } from '../../domain/entities/tenant-settings.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';

export class TenantSettingsResponseDto {
  id: string;
  tenantId: string;
  primaryCurrency: Currency;
  maxTransactionAmount: string;
  feeType: FeeType;
  feeValue: string;
  createdAt: string;
  updatedAt: string;

  public static fromDomain(settings: TenantSettings): TenantSettingsResponseDto {
    const dto = new TenantSettingsResponseDto();
    dto.id = settings.getId();
    dto.tenantId = settings.getTenantId();
    dto.primaryCurrency = settings.getPrimaryCurrency();
    dto.maxTransactionAmount = settings.getMaxTransactionAmount();
    dto.feeType = settings.getFeeType();
    dto.feeValue = settings.getFeeValue();
    dto.createdAt = settings.getCreatedAt().toISOString();
    dto.updatedAt = settings.getUpdatedAt().toISOString();
    return dto;
  }
}

