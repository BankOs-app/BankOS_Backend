import { ExchangeRate } from '../../domain/entities/exchange-rate.entity';
import { Currency } from '../../domain/value-objects/currency.enum';

export class ExchangeRateResponseDto {
  id: string;
  tenantId: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: string;
  createdAt: string;
  updatedAt: string;

  public static fromDomain(rate: ExchangeRate): ExchangeRateResponseDto {
    const dto = new ExchangeRateResponseDto();
    dto.id = rate.getId();
    dto.tenantId = rate.getTenantId();
    dto.fromCurrency = rate.getFromCurrency();
    dto.toCurrency = rate.getToCurrency();
    dto.rate = rate.getRate();
    dto.createdAt = rate.getCreatedAt().toISOString();
    dto.updatedAt = rate.getUpdatedAt().toISOString();
    return dto;
  }
}

