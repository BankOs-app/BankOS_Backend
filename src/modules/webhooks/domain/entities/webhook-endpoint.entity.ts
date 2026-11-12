import { randomBytes, randomUUID } from 'node:crypto';

export interface WebhookEndpointProps {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
}

/**
 * Entidad de Dominio: Endpoint de Webhook registrado por un Tenant (HU-15).
 */
export class WebhookEndpoint {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly url: string;
  private readonly secret: string;
  private readonly events: string[];
  private isActive: boolean;
  private readonly createdAt: Date;

  private constructor(props: WebhookEndpointProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.url = props.url;
    this.secret = props.secret;
    this.events = props.events;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
  }

  public static create(params: {
    tenantId: string;
    url: string;
    events: string[];
    secret?: string;
  }): WebhookEndpoint {
    if (!params.tenantId) throw new Error('El tenantId es obligatorio.');
    if (!params.url) throw new Error('La URL del webhook es obligatoria.');
    if (!params.events || params.events.length === 0) {
      throw new Error('Debe especificar al menos un evento suscrito.');
    }

    const generatedSecret = params.secret ?? randomBytes(32).toString('hex');

    return new WebhookEndpoint({
      id: randomUUID(),
      tenantId: params.tenantId,
      url: params.url.trim(),
      secret: generatedSecret,
      events: params.events,
      isActive: true,
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: WebhookEndpointProps): WebhookEndpoint {
    return new WebhookEndpoint(props);
  }

  public isSubscribedTo(eventType: string): boolean {
    return this.isActive && this.events.includes(eventType);
  }

  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getUrl(): string {
    return this.url;
  }

  public getSecret(): string {
    return this.secret;
  }

  public getEvents(): string[] {
    return [...this.events];
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }
}

