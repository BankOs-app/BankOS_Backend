import { randomUUID } from 'node:crypto';
import { LedgerEntryType } from '../../../transactions/domain/value-objects/transaction-types.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';

export interface LedgerEntryProps {
  id: string;
  tenantId: string;
  transactionId: string;
  accountId: string;
  type: LedgerEntryType;
  amount: string;
  currency: Currency;
  createdAt: Date;
}

/**
 * Entidad de Dominio: Asiento Contable (Ledger Entry).
 *
 * Registra cada movimiento individual (débito o crédito) para garantizar
 * la trazabilidad contable y el equilibrio financiero del banco.
 */
export class LedgerEntry {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly transactionId: string;
  private readonly accountId: string;
  private readonly type: LedgerEntryType;
  private readonly amount: string;
  private readonly currency: Currency;
  private readonly createdAt: Date;

  private constructor(props: LedgerEntryProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.transactionId = props.transactionId;
    this.accountId = props.accountId;
    this.type = props.type;
    this.amount = props.amount;
    this.currency = props.currency;
    this.createdAt = props.createdAt;
  }

  public static create(params: {
    tenantId: string;
    transactionId: string;
    accountId: string;
    type: LedgerEntryType;
    amount: string;
    currency: Currency;
  }): LedgerEntry {
    return new LedgerEntry({
      id: randomUUID(),
      tenantId: params.tenantId,
      transactionId: params.transactionId,
      accountId: params.accountId,
      type: params.type,
      amount: params.amount,
      currency: params.currency,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: LedgerEntryProps): LedgerEntry {
    return new LedgerEntry(props);
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getTransactionId(): string {
    return this.transactionId;
  }

  public getAccountId(): string {
    return this.accountId;
  }

  public getType(): LedgerEntryType {
    return this.type;
  }

  public getAmount(): string {
    return this.amount;
  }

  public getCurrency(): Currency {
    return this.currency;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
