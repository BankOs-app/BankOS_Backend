import { randomUUID } from 'node:crypto';
import { TenantStatus } from '../value-objects/tenant-status.enum';
import { TenantSlug } from '../value-objects/tenant-slug.vo';
import { Currency } from '../value-objects/currency.enum';
import { FeeType } from '../value-objects/fee-type.enum';

export interface TenantProps {
  id: string;
  name: string;
  slug: TenantSlug;
  schemaName: string;
  status: TenantStatus;
  primaryCurrency: Currency;
  maxTransactionAmount: string;
  feeType: FeeType;
  feeValue: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidad de Dominio que representa una institución financiera (Tenant).
 *
 * Principio de Arquitectura Limpia:
 * Esta clase no depende de ningún framework (NestJS), ORM (Drizzle) ni base de datos.
 * Contiene únicamente lógica pura de negocio y reglas de validación.
 */
export class Tenant {
  private readonly id: string;
  private name: string;
  private readonly slug: TenantSlug;
  private readonly schemaName: string;
  private status: TenantStatus;
  private primaryCurrency: Currency;
  private maxTransactionAmount: string;
  private feeType: FeeType;
  private feeValue: string;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: TenantProps) {
    this.validateName(props.name);
    this.id = props.id;
    this.name = props.name.trim();
    this.slug = props.slug;
    this.schemaName = props.schemaName;
    this.status = props.status;
    this.primaryCurrency = props.primaryCurrency;
    this.maxTransactionAmount = props.maxTransactionAmount;
    this.feeType = props.feeType;
    this.feeValue = props.feeValue;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Fábrica de dominio para crear un nuevo Tenant en estado inicial PROVISIONING.
   */
  public static create(
    name: string,
    rawSlug: string,
    settings?: {
      primaryCurrency?: Currency;
      maxTransactionAmount?: string;
      feeType?: FeeType;
      feeValue?: string;
    },
  ): Tenant {
    const slugVo = new TenantSlug(rawSlug);
    const id = randomUUID();

    // Generamos un nombre de esquema seguro para PostgreSQL:
    // Reemplazamos los guiones del slug por guiones bajos para que sea un identificador SQL válido.
    const safeSchemaName = `tenant_${slugVo.getValue().replace(/-/g, '_')}`;

    const now = new Date();
    return new Tenant({
      id,
      name,
      slug: slugVo,
      schemaName: safeSchemaName,
      status: TenantStatus.PROVISIONING,
      primaryCurrency: settings?.primaryCurrency ?? Currency.COP,
      maxTransactionAmount: settings?.maxTransactionAmount ?? '50000000.00',
      feeType: settings?.feeType ?? FeeType.FIXED,
      feeValue: settings?.feeValue ?? '0.0000',
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstruye una entidad desde la base de datos (persistencia).
   */
  public static reconstitute(props: {
    id: string;
    name: string;
    slug: string;
    schemaName: string;
    status: TenantStatus;
    primaryCurrency?: Currency;
    maxTransactionAmount?: string;
    feeType?: FeeType;
    feeValue?: string;
    createdAt: Date;
    updatedAt: Date;
  }): Tenant {
    return new Tenant({
      id: props.id,
      name: props.name,
      slug: new TenantSlug(props.slug),
      schemaName: props.schemaName,
      status: props.status,
      primaryCurrency: props.primaryCurrency ?? Currency.COP,
      maxTransactionAmount: props.maxTransactionAmount ?? '50000000.00',
      feeType: props.feeType ?? FeeType.FIXED,
      feeValue: props.feeValue ?? '0.0000',
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * Marca el tenant como activo una vez aprovisionado su esquema.
   */
  public markAsActive(): void {
    if (this.status === TenantStatus.ACTIVE) {
      return;
    }
    this.status = TenantStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Marca el tenant como fallido si ocurre algún error durante el aprovisionamiento.
   */
  public markAsFailed(): void {
    this.status = TenantStatus.FAILED;
    this.updatedAt = new Date();
  }

  public updateFinancialSettings(
    primaryCurrency: Currency,
    maxTransactionAmount: string,
    feeType: FeeType,
    feeValue: string,
  ): void {
    this.primaryCurrency = primaryCurrency;
    this.maxTransactionAmount = maxTransactionAmount;
    this.feeType = feeType;
    this.feeValue = feeValue;
    this.updatedAt = new Date();
  }

  public canOperate(): boolean {
    return this.status === TenantStatus.ACTIVE;
  }

  private validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('El nombre de la institución es obligatorio');
    }
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 100) {
      throw new Error('El nombre de la institución debe tener entre 3 y 100 caracteres');
    }
  }

  // Getters para consultar propiedades sin permitir mutación directa
  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getSlug(): TenantSlug {
    return this.slug;
  }

  public getSchemaName(): string {
    return this.schemaName;
  }

  public getStatus(): TenantStatus {
    return this.status;
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
