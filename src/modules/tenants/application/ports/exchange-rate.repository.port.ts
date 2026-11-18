import { ExchangeRate } from '../../domain/entities/exchange-rate.entity';
import { Currency } from '../../domain/value-objects/currency.enum';

export const EXCHANGE_RATE_REPOSITORY = Symbol('EXCHANGE_RATE_REPOSITORY');

/**
 * Puerto de persistencia para las tasas de cambio de divisas por Tenant.
 */
export interface ExchangeRateRepository {
  findRate(
    tenantId: string,
    fromCurrency: Currency,
    toCurrency: Currency,
  ): Promise<ExchangeRate | null>;

  listByTenantId(tenantId: string): Promise<ExchangeRate[]>;

  saveOrUpdate(exchangeRate: ExchangeRate): Promise<void>;
}

