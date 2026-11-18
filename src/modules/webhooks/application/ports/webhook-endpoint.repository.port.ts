import { WebhookEndpoint } from '../../domain/entities/webhook-endpoint.entity';

export const WEBHOOK_ENDPOINT_REPOSITORY = Symbol('WEBHOOK_ENDPOINT_REPOSITORY');

export interface WebhookEndpointRepository {
  save(endpoint: WebhookEndpoint): Promise<void>;
  findById(id: string): Promise<WebhookEndpoint | null>;
  findByTenantId(tenantId: string): Promise<WebhookEndpoint[]>;
  findByTenantAndEvent(tenantId: string, eventType: string): Promise<WebhookEndpoint[]>;
}

