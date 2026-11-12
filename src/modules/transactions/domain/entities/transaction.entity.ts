import { randomUUID } from 'node:crypto';
import {
  TransactionType,
  TransactionStatus,
} from '../value-objects/transaction-types.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';

export interface TransactionProps {
  id: string;
  tenantId: string;
  type: TransactionType;
  sourceAccountId?: string;
  destinationAccountId?: string;
  originalAmount: string;
  originalCurrency: Currency;
  convertedAmount?: string;
  destinationCurrency?: Currency;
  exchangeRateApplied?: string;
  feeAmount?: string;
  status: TransactionStatus;
  idempotencyKey: string;
  createdAt: Date;
}

/**
 * Entidad de Dominio: Transacción Financiera.
 *
 * Registra una fotografía inmutable de la operación bancaria con importes,
 * comisiones y tasas de cambio en el instante de su ejecución (CA-HU-02-04).
 */
export class Transaction {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly type: TransactionType;
  private readonly sourceAccountId?: string;
  private readonly destinationAccountId?: string;
  private readonly originalAmount: string;
  private readonly originalCurrency: Currency;
  private readonly convertedAmount?: string;
  private readonly destinationCurrency?: Currency;
  private readonly exchangeRateApplied?: string;
  private readonly feeAmount?: string;
  private status: TransactionStatus;
  private readonly idempotencyKey: string;
  private readonly createdAt: Date;

  private constructor(props: TransactionProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.type = props.type;
    this.sourceAccountId = props.sourceAccountId;
    this.destinationAccountId = props.destinationAccountId;
    this.originalAmount = props.originalAmount;
    this.originalCurrency = props.originalCurrency;
    this.convertedAmount = props.convertedAmount;
    this.destinationCurrency = props.destinationCurrency;
    this.exchangeRateApplied = props.exchangeRateApplied;
    this.feeAmount = props.feeAmount;
    this.status = props.status;
    this.idempotencyKey = props.idempotencyKey;
    this.createdAt = props.createdAt;
  }

  public static createDeposit(params: {
    tenantId: string;
    destinationAccountId: string;
    amount: string;
    currency: Currency;
    idempotencyKey: string;
  }): Transaction {
    const amountNum = Number(params.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('El monto del depósito debe ser estrictamente mayor a 0.');
    }

    return new Transaction({
      id: randomUUID(),
      tenantId: params.tenantId,
      type: TransactionType.DEPOSIT,
      destinationAccountId: params.destinationAccountId,
      originalAmount: params.amount,
      originalCurrency: params.currency,
      status: TransactionStatus.SUCCESS,
      idempotencyKey: params.idempotencyKey,
      createdAt: new Date(),
    });
  }

  public static createWithdrawal(params: {
    tenantId: string;
    sourceAccountId: string;
    amount: string;
    currency: Currency;
    idempotencyKey: string;
  }): Transaction {
    const amountNum = Number(params.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('El monto del retiro debe ser estrictamente mayor a 0.');
    }

    return new Transaction({
      id: randomUUID(),
      tenantId: params.tenantId,
      type: TransactionType.WITHDRAWAL,
      sourceAccountId: params.sourceAccountId,
      originalAmount: params.amount,
      originalCurrency: params.currency,
      status: TransactionStatus.SUCCESS,
      idempotencyKey: params.idempotencyKey,
      createdAt: new Date(),
    });
  }

  public static createTransfer(params: {
    tenantId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    originalAmount: string;
    originalCurrency: Currency;
    convertedAmount?: string;
    destinationCurrency?: Currency;
    exchangeRateApplied?: string;
    feeAmount?: string;
    idempotencyKey: string;
  }): Transaction {
    const amountNum = Number(params.originalAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('El monto de la transferencia debe ser estrictamente mayor a 0.');
    }

    return new Transaction({
      id: randomUUID(),
      tenantId: params.tenantId,
      type: TransactionType.TRANSFER,
      sourceAccountId: params.sourceAccountId,
      destinationAccountId: params.destinationAccountId,
      originalAmount: params.originalAmount,
      originalCurrency: params.originalCurrency,
      convertedAmount: params.convertedAmount,
      destinationCurrency: params.destinationCurrency,
      exchangeRateApplied: params.exchangeRateApplied,
      feeAmount: params.feeAmount,
      status: TransactionStatus.SUCCESS,
      idempotencyKey: params.idempotencyKey,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getType(): TransactionType {
    return this.type;
  }

  public getSourceAccountId(): string | undefined {
    return this.sourceAccountId;
  }

  public getDestinationAccountId(): string | undefined {
    return this.destinationAccountId;
  }

  public getOriginalAmount(): string {
    return this.originalAmount;
  }

  public getOriginalCurrency(): Currency {
    return this.originalCurrency;
  }

  public getConvertedAmount(): string | undefined {
    return this.convertedAmount;
  }

  public getDestinationCurrency(): Currency | undefined {
    return this.destinationCurrency;
  }

  public getExchangeRateApplied(): string | undefined {
    return this.exchangeRateApplied;
  }

  public getFeeAmount(): string | undefined {
    return this.feeAmount;
  }

  public getStatus(): TransactionStatus {
    return this.status;
  }

  public getIdempotencyKey(): string {
    return this.idempotencyKey;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}
