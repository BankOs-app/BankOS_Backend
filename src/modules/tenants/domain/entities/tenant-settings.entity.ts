import { randomUUID } from 'node:crypto';
import { Currency } from '../value-objects/currency.enum';
import { FeeType } from '../value-objects/fee-type.enum';

export interface TenantSettingsProps {
  id: string;
  tenantId: string;
  primaryCurrency: Currency;
  maxTransactionAmount: string;
  feeType: FeeType;
  feeValue: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidad de Dominio que modela las reglas y configuraciones financieras del Tenant.
 *
 * Principio de Precisión Financiera:
 * Los montos y porcentajes se manejan internamente como strings decimales canónicos
 * para evitar los errores de redondeo inherentes al tipo 'number' (IEEE 754 float) en JS.
 */
export class TenantSettings {
  private readonly id: string;
  private readonly tenantId: string;
  private primaryCurrency: Currency;
  private maxTransactionAmount: string;
  private feeType: FeeType;
  private feeValue: string;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: TenantSettingsProps) {
    this.validate(props);
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.primaryCurrency = props.primaryCurrency;
    this.maxTransactionAmount = props.maxTransactionAmount;
    this.feeType = props.feeType;
    this.feeValue = props.feeValue;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static createDefault(tenantId: string): TenantSettings {
    const now = new Date();
    return new TenantSettings({
      id: randomUUID(),
      tenantId,
      primaryCurrency: Currency.COP,
      maxTransactionAmount: '50000000.00', // 50 millones COP por defecto
      feeType: FeeType.FIXED,
      feeValue: '0.00',
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: TenantSettingsProps): TenantSettings {
    return new TenantSettings(props);
  }

  public update(params: {
    primaryCurrency: Currency;
    maxTransactionAmount: string;
    feeType: FeeType;
    feeValue: string;
  }): void {
    this.validate({
      id: this.id,
      tenantId: this.tenantId,
      ...params,
      createdAt: this.createdAt,
      updatedAt: new Date(),
    });

    this.primaryCurrency = params.primaryCurrency;
    this.maxTransactionAmount = params.maxTransactionAmount;
    this.feeType = params.feeType;
    this.feeValue = params.feeValue;
    this.updatedAt = new Date();
  }

  private validate(props: TenantSettingsProps): void {
    if (!props.tenantId) {
      throw new Error('El tenantId es obligatorio para la configuración.');
    }

    if (!Object.values(Currency).includes(props.primaryCurrency)) {
      throw new Error(`Moneda no soportada: ${props.primaryCurrency}`);
    }

    const maxAmountNum = Number(props.maxTransactionAmount);
    if (isNaN(maxAmountNum) || maxAmountNum <= 0) {
      throw new Error(
        'El límite máximo por transacción debe ser un número positivo estrictamente mayor a 0.',
      );
    }

    const feeNum = Number(props.feeValue);
    if (isNaN(feeNum) || feeNum < 0) {
      throw new Error('El valor de la comisión no puede ser negativo.');
    }

    if (props.feeType === FeeType.PERCENTAGE) {
      if (feeNum < 0 || feeNum > 100) {
        throw new Error(
          'La comisión porcentual debe encontrarse dentro del rango permitido (0% a 100%).',
        );
      }
    }
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getPrimaryCurrency(): Currency {
    return this.primaryCurrency;
  }

  public getMaxTransactionAmount(): string {
    return this.maxTransactionAmount;
  }

  public getFeeType(): FeeType {
    return this.feeType;
  }

  public getFeeValue(): string {
    return this.feeValue;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

