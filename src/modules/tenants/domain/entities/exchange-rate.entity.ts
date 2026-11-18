import { randomUUID } from 'node:crypto';
import { Currency } from '../value-objects/currency.enum';

export interface ExchangeRateProps {
  id: string;
  tenantId: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidad de Dominio que modela una Tasa de Cambio Estática por Tenant.
 *
 * Convención de cotización:
 * La tasa representa cuántas unidades de 'toCurrency' (moneda cotizada / quote)
 * equivalen a UNA unidad de 'fromCurrency' (moneda base).
 *
 * Ejemplo:
 * fromCurrency: USD, toCurrency: COP, rate: "4000.00"
 * Significa: 1 USD = 4000 COP.
 */
export class ExchangeRate {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly fromCurrency: Currency;
  private readonly toCurrency: Currency;
  private rate: string;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: ExchangeRateProps) {
    this.validate(props);
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.fromCurrency = props.fromCurrency;
    this.toCurrency = props.toCurrency;
    this.rate = props.rate;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(params: {
    tenantId: string;
    fromCurrency: Currency;
    toCurrency: Currency;
    rate: string;
  }): ExchangeRate {
    const now = new Date();
    return new ExchangeRate({
      id: randomUUID(),
      tenantId: params.tenantId,
      fromCurrency: params.fromCurrency,
      toCurrency: params.toCurrency,
      rate: params.rate,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: ExchangeRateProps): ExchangeRate {
    return new ExchangeRate(props);
  }

  public updateRate(newRate: string): void {
    const rateNum = Number(newRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      throw new Error(
        'La tasa de cambio debe ser un valor numérico estrictamente mayor a 0.',
      );
    }
    this.rate = newRate;
    this.updatedAt = new Date();
  }

  private validate(props: ExchangeRateProps): void {
    if (!props.tenantId) {
      throw new Error('El tenantId es obligatorio para la tasa de cambio.');
    }

    if (!Object.values(Currency).includes(props.fromCurrency)) {
      throw new Error(`Moneda origen no soportada: ${props.fromCurrency}`);
    }

    if (!Object.values(Currency).includes(props.toCurrency)) {
      throw new Error(`Moneda destino no soportada: ${props.toCurrency}`);
    }

    if (props.fromCurrency === props.toCurrency) {
      throw new Error(
        'El par de divisas debe tener monedas origen y destino distintas.',
      );
    }

    const rateNum = Number(props.rate);
    if (isNaN(rateNum) || rateNum <= 0) {
      throw new Error(
        'La tasa de cambio debe ser un valor numérico estrictamente mayor a 0.',
      );
    }
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getFromCurrency(): Currency {
    return this.fromCurrency;
  }

  public getToCurrency(): Currency {
    return this.toCurrency;
  }

  public getRate(): string {
    return this.rate;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

