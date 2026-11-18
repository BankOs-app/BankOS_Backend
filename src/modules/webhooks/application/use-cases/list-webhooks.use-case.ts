import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { WEBHOOK_ENDPOINT_REPOSITORY } from '../ports/webhook-endpoint.repository.port';
import type { WebhookEndpointRepository } from '../ports/webhook-endpoint.repository.port';

export interface WebhookEndpointDto {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

/**
 * Caso de Uso: Listar Endpoints de Webhook de un Tenant (HU-15).
 * Por seguridad (T02), no expone los secretos en texto plano.
 */
@Injectable()
export class ListWebhooksUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(WEBHOOK_ENDPOINT_REPOSITORY)
    private readonly webhookRepository: WebhookEndpointRepository,
  ) {}

  async execute(tenantSlug: string): Promise<WebhookEndpointDto[]> {
    const tenant = await this.tenantRepository.findBySlug(
      tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${tenantSlug}'`);
    }

    const endpoints = await this.webhookRepository.findByTenantId(tenant.getId());

    return endpoints.map((ep) => ({
      id: ep.getId(),
      url: ep.getUrl(),
      events: ep.getEvents(),
      isActive: ep.getIsActive(),
      createdAt: ep.getCreatedAt().toISOString(),
    }));
  }
}

