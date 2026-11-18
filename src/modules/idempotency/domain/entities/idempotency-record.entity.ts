import { randomUUID } from 'node:crypto';
import { IdempotencyStatus } from '../value-objects/idempotency-status.enum';

export interface IdempotencyRecordProps {
  id: string;
  tenantId: string;
  userId: string;
  key: string;
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus?: number;
  responseBody?: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Entidad de Dominio que modela el registro y bloqueo de una operación idempotente.
 *
 * Vigencia: Las claves tienen una validez estricta de 24 horas según la regla de negocio.
 */
export class IdempotencyRecord {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly userId: string;
  private readonly key: string;
  private readonly requestHash: string;
  private status: IdempotencyStatus;
  private responseStatus?: number;
  private responseBody?: string;
  private readonly createdAt: Date;
  private readonly expiresAt: Date;

  private constructor(props: IdempotencyRecordProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.userId = props.userId;
    this.key = props.key;
    this.requestHash = props.requestHash;
    this.status = props.status;
    this.responseStatus = props.responseStatus;
    this.responseBody = props.responseBody;
    this.createdAt = props.createdAt;
    this.expiresAt = props.expiresAt;
  }

  /**
   * Crea un nuevo registro de bloqueo en estado inicial PROCESSING con 24h de expiración.
   */
  public static create(params: {
    tenantId: string;
    userId: string;
    key: string;
    requestHash: string;
  }): IdempotencyRecord {
    const now = new Date();
    // Expiración a las 24 horas
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return new IdempotencyRecord({
      id: randomUUID(),
      tenantId: params.tenantId,
      userId: params.userId,
      key: params.key,
      requestHash: params.requestHash,
      status: IdempotencyStatus.PROCESSING,
      createdAt: now,
      expiresAt,
    });
  }

  public static reconstitute(props: IdempotencyRecordProps): IdempotencyRecord {
    return new IdempotencyRecord(props);
  }

  public markSucceeded(responseStatus: number, responseBody: string): void {
    this.status = IdempotencyStatus.SUCCEEDED;
    this.responseStatus = responseStatus;
    this.responseBody = responseBody;
  }

  public markFailed(): void {
    this.status = IdempotencyStatus.FAILED;
  }

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  public isProcessing(): boolean {
    return this.status === IdempotencyStatus.PROCESSING && !this.isExpired();
  }

  public isSucceeded(): boolean {
    return this.status === IdempotencyStatus.SUCCEEDED && !this.isExpired();
  }

  public matchesHash(hash: string): boolean {
    return this.requestHash === hash;
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getKey(): string {
    return this.key;
  }

  public getRequestHash(): string {
    return this.requestHash;
  }

  public getStatus(): IdempotencyStatus {
    return this.status;
  }

  public getResponseStatus(): number | undefined {
    return this.responseStatus;
  }

  public getResponseBody(): string | undefined {
    return this.responseBody;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getExpiresAt(): Date {
    return this.expiresAt;
  }
}

