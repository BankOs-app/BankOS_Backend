import { randomUUID } from 'node:crypto';
import { AccountStatus } from '../value-objects/account-status.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';

export interface AccountProps {
  id: string;
  tenantId: string;
  customerId: string;
  accountNumber: string;
  currency: Currency;
  balance: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidad de Dominio: Cuenta Bancaria.
 *
 * Principio de Integridad Financiera:
 * - El saldo se maneja como un string numérico decimal de alta precisión.
 * - Una cuenta inactiva o bloqueada no puede operar financieramente (CA-HU-05-04).
 * - La desactivación se realiza mediante Soft Delete (cambio de estado a INACTIVE).
 */
export class Account {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly customerId: string;
  private readonly accountNumber: string;
  private readonly currency: Currency;
  private balance: string;
  private status: AccountStatus;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: AccountProps) {
    this.validate(props);
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.customerId = props.customerId;
    this.accountNumber = props.accountNumber.trim();
    this.currency = props.currency;
    this.balance = props.balance;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(params: {
    tenantId: string;
    customerId: string;
    accountNumber: string;
    currency: Currency;
    initialBalance?: string;
  }): Account {
    const now = new Date();
    return new Account({
      id: randomUUID(),
      tenantId: params.tenantId,
      customerId: params.customerId,
      accountNumber: params.accountNumber,
      currency: params.currency,
      balance: params.initialBalance ?? '0.00',
      status: AccountStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: AccountProps): Account {
    return new Account(props);
  }

  /**
   * Verifica si la cuenta tiene permitido realizar transacciones financieras.
   */
  public canTransact(): boolean {
    return this.status === AccountStatus.ACTIVE;
  }

  /**
   * Bloquea la cuenta temporalmente.
   */
  public block(): void {
    this.status = AccountStatus.BLOCKED;
    this.updatedAt = new Date();
  }

  /**
   * Desactiva la cuenta mediante borrado lógico (Soft Delete).
   * La cuenta no se elimina físicamente para preservar el historial contable.
   */
  public deactivate(): void {
    this.status = AccountStatus.INACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Reactiva una cuenta previamente bloqueada o inactiva.
   */
  public activate(): void {
    this.status = AccountStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Incrementa el saldo (Depósito o abono).
   */
  public credit(amount: string): void {
    if (!this.canTransact()) {
      throw new Error(
        `No se puede acreditar una cuenta en estado '${this.status}'.`,
      );
    }
    const currentNum = Number(this.balance);
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('El monto a acreditar debe ser mayor a 0.');
    }
    this.balance = (currentNum + amountNum).toFixed(2);
    this.updatedAt = new Date();
  }

  /**
   * Debita el saldo (Retiro o transferencia saliente).
   */
  public debit(amount: string): void {
    if (!this.canTransact()) {
      throw new Error(
        `No se puede debitar una cuenta en estado '${this.status}'.`,
      );
    }
    const currentNum = Number(this.balance);
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('El monto a debitar debe ser mayor a 0.');
    }
    if (currentNum < amountNum) {
      throw new Error('Saldo insuficiente para realizar el débito.');
    }
    this.balance = (currentNum - amountNum).toFixed(2);
    this.updatedAt = new Date();
  }

  private validate(props: AccountProps): void {
    if (!props.tenantId) {
      throw new Error('El tenantId es obligatorio para la cuenta.');
    }
    if (!props.customerId) {
      throw new Error('El customerId es obligatorio para la cuenta.');
    }
    if (!props.accountNumber || props.accountNumber.trim().length < 6) {
      throw new Error('El número de cuenta debe tener al menos 6 caracteres.');
    }
    if (!Object.values(Currency).includes(props.currency)) {
      throw new Error(`Moneda no soportada: ${props.currency}`);
    }
    const balNum = Number(props.balance);
    if (isNaN(balNum) || balNum < 0) {
      throw new Error('El saldo inicial no puede ser negativo.');
    }
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getCustomerId(): string {
    return this.customerId;
  }

  public getAccountNumber(): string {
    return this.accountNumber;
  }

  public getCurrency(): Currency {
    return this.currency;
  }

  public getBalance(): string {
    return this.balance;
  }

  public getStatus(): AccountStatus {
    return this.status;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

