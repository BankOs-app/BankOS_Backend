import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WEBHOOK_ENDPOINT_REPOSITORY } from './application/ports/webhook-endpoint.repository.port';
import { DrizzleWebhookEndpointRepository } from './infrastructure/persistence/drizzle-webhook-endpoint.repository';
import { OUTBOX_REPOSITORY } from './application/ports/outbox.repository.port';
import { DrizzleOutboxRepository } from './infrastructure/persistence/drizzle-outbox.repository';
import { RegisterWebhookUseCase } from './application/use-cases/register-webhook.use-case';
import { ListWebhooksUseCase } from './application/use-cases/list-webhooks.use-case';
import { OutboxDispatcherService } from './application/services/outbox-dispatcher.service';
import { WebhooksController } from './presentation/controllers/webhooks.controller';

/**
 * Módulo de Webhooks y Outbox Pattern (Épica EP-07: HU-15).
 */
@Module({
  imports: [DatabaseModule, TenantsModule],
  controllers: [WebhooksController],
  providers: [
    RegisterWebhookUseCase,
    ListWebhooksUseCase,
    OutboxDispatcherService,
    {
      provide: WEBHOOK_ENDPOINT_REPOSITORY,
      useClass: DrizzleWebhookEndpointRepository,
    },
    {
      provide: OUTBOX_REPOSITORY,
      useClass: DrizzleOutboxRepository,
    },
  ],
  exports: [
    WEBHOOK_ENDPOINT_REPOSITORY,
    OUTBOX_REPOSITORY,
    RegisterWebhookUseCase,
    ListWebhooksUseCase,
    OutboxDispatcherService,
  ],
})
export class WebhooksModule {}
