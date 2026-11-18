import { randomUUID } from 'node:crypto';

export enum OutboxStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export interface OutboxEventProps {
  id: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidad de Dominio: Evento en Outbox Transaccional (HU-15).
 *
 * Se inserta de forma consistente con las operaciones financieras.
 * El worker asíncrono lo consume para despachar webhooks sin afectar
 * el estado financiero de las transferencias.
 */
export class OutboxEvent {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly eventType: string;
  private readonly payload: Record<string, unknown>;
  private status: OutboxStatus;
  private attempts: number;
  private readonly maxAttempts: number;
  private nextRetryAt?: Date | null;
  private lastError?: string | null;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: OutboxEventProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.eventType = props.eventType;
    this.payload = props.payload;
    this.status = props.status;
    this.attempts = props.attempts;
    this.maxAttempts = props.maxAttempts;
    this.nextRetryAt = props.nextRetryAt;
    this.lastError = props.lastError;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(params: {
    tenantId: string;
    eventType: string;
    payload: Record<string, unknown>;
    maxAttempts?: number;
  }): OutboxEvent {
    const now = new Date();
    return new OutboxEvent({
      id: randomUUID(),
      tenantId: params.tenantId,
      eventType: params.eventType,
      payload: params.payload,
      status: OutboxStatus.PENDING,
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 3,
      nextRetryAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: OutboxEventProps): OutboxEvent {
    return new OutboxEvent(props);
  }

  public markDelivered(): void {
    this.status = OutboxStatus.DELIVERED;
    this.nextRetryAt = null;
    this.updatedAt = new Date();
  }

  public recordAttemptFailure(errorMessage: string, retryDelaySeconds: number = 60): void {
    this.attempts += 1;
    this.lastError = errorMessage.substring(0, 1000);
    this.updatedAt = new Date();

    if (this.attempts >= this.maxAttempts) {
      this.status = OutboxStatus.FAILED;
      this.nextRetryAt = null;
    } else {
      this.status = OutboxStatus.PENDING;
      this.nextRetryAt = new Date(Date.now() + retryDelaySeconds * 1000);
    }
  }

  public isPending(): boolean {
    return this.status === OutboxStatus.PENDING;
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getEventType(): string {
    return this.eventType;
  }

  public getPayload(): Record<string, unknown> {
    return this.payload;
  }

  public getStatus(): OutboxStatus {
    return this.status;
  }

  public getAttempts(): number {
    return this.attempts;
  }

  public getMaxAttempts(): number {
    return this.maxAttempts;
  }

  public getNextRetryAt(): Date | null | undefined {
    return this.nextRetryAt;
  }

  public getLastError(): string | null | undefined {
    return this.lastError;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

