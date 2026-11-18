import { BadRequestException } from '@nestjs/common';
import { RegisterWebhookUseCase } from './application/use-cases/register-webhook.use-case';
import { ListWebhooksUseCase } from './application/use-cases/list-webhooks.use-case';
import { OutboxDispatcherService } from './application/services/outbox-dispatcher.service';
import { WebhookEndpoint } from './domain/entities/webhook-endpoint.entity';
import { OutboxEvent, OutboxStatus } from './domain/entities/outbox-event.entity';
import { Tenant } from '../tenants/domain/entities/tenant.entity';
import type { WebhookEndpointRepository } from './application/ports/webhook-endpoint.repository.port';
import type { OutboxRepository } from './application/ports/outbox.repository.port';
import type { TenantRepository } from '../tenants/application/ports/tenant.repository.port';

describe('Webhooks & Outbox Pattern (HU-15)', () => {
  let webhookRepo: jest.Mocked<WebhookEndpointRepository>;
  let outboxRepo: jest.Mocked<OutboxRepository>;
  let tenantRepo: jest.Mocked<TenantRepository>;
  let mockTenant: Tenant;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco de Bogotá', 'banco-bogota');

    webhookRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findByTenantId: jest.fn().mockResolvedValue([]),
      findByTenantAndEvent: jest.fn().mockResolvedValue([]),
    };

    outboxRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findPendingEvents: jest.fn().mockResolvedValue([]),
      findByTenantId: jest.fn().mockResolvedValue([]),
    };

    tenantRepo = {
      findBySlug: jest.fn().mockImplementation((slug) => {
        if (slug === 'banco-bogota') return Promise.resolve(mockTenant);
        return Promise.resolve(null);
      }),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockTenant),
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    };
  });

  describe('RegisterWebhookUseCase', () => {
    it('debe registrar un endpoint de webhook válido y generar un secreto de firma seguro', async () => {
      const useCase = new RegisterWebhookUseCase(tenantRepo, webhookRepo);

      const result = await useCase.execute({
        tenantSlug: 'banco-bogota',
        url: 'https://webhook.site/test-endpoint',
        events: ['transfer.completed'],
      });

      expect(webhookRepo.save).toHaveBeenCalledTimes(1);
      expect(result.url).toBe('https://webhook.site/test-endpoint');
      expect(result.events).toEqual(['transfer.completed']);
      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(16);
      expect(result.isActive).toBe(true);
    });

    it('debe rechazar destinos de metadata de nubes para mitigar ataques SSRF', async () => {
      const useCase = new RegisterWebhookUseCase(tenantRepo, webhookRepo);

      await expect(
        useCase.execute({
          tenantSlug: 'banco-bogota',
          url: 'http://169.254.169.254/latest/meta-data/',
          events: ['transfer.completed'],
        }),
      ).rejects.toThrow('SSRF');

      expect(webhookRepo.save).not.toHaveBeenCalled();
    });

    it('debe rechazar URLs con formato inválido o protocolos no permitidos', async () => {
      const useCase = new RegisterWebhookUseCase(tenantRepo, webhookRepo);

      await expect(
        useCase.execute({
          tenantSlug: 'banco-bogota',
          url: 'ftp://mi-servidor.com/webhook',
          events: ['transfer.completed'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('ListWebhooksUseCase', () => {
    it('debe listar los webhooks registrados sin revelar secretos en texto plano', async () => {
      const ep = WebhookEndpoint.create({
        tenantId: mockTenant.getId(),
        url: 'https://webhook.site/test',
        events: ['transfer.completed'],
      });
      webhookRepo.findByTenantId.mockResolvedValue([ep]);

      const useCase = new ListWebhooksUseCase(tenantRepo, webhookRepo);
      const list = await useCase.execute('banco-bogota');

      expect(list.length).toBe(1);
      expect(list[0].url).toBe('https://webhook.site/test');
      expect((list[0] as Record<string, unknown>).secret).toBeUndefined();
    });
  });

  describe('OutboxDispatcherService (CA-HU-15-02, CA-HU-15-03, CA-HU-15-04)', () => {
    it('CA-HU-15-02: debe despachar exitosamente evento firmado a endpoint suscrito y marcarlo DELIVERED', async () => {
      const endpoint = WebhookEndpoint.create({
        tenantId: mockTenant.getId(),
        url: 'https://api.empresa.com/webhook',
        events: ['transfer.completed'],
        secret: 'super-secret-key-1234',
      });

      const event = OutboxEvent.create({
        tenantId: mockTenant.getId(),
        eventType: 'transfer.completed',
        payload: { transactionId: 'tx-123', amount: '500.00' },
      });

      webhookRepo.findByTenantAndEvent.mockResolvedValue([endpoint]);

      // Mockeamos global.fetch
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      global.fetch = fetchMock;

      const dispatcher = new OutboxDispatcherService(outboxRepo, webhookRepo);
      const success = await dispatcher.processSingleEvent(event);

      expect(success).toBe(true);
      expect(event.getStatus()).toBe(OutboxStatus.DELIVERED);
      expect(outboxRepo.update).toHaveBeenCalledWith(event);

      // Verificar que fetch fue invocado con headers requeridos
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.empresa.com/webhook');
      expect(options.headers['X-BankOS-Event']).toBe('transfer.completed');
      expect(options.headers['X-BankOS-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it('CA-HU-15-03: ante fallo HTTP 500 debe registrar fallo, incrementar intentos y mantener PENDING sin revertir nada', async () => {
      const endpoint = WebhookEndpoint.create({
        tenantId: mockTenant.getId(),
        url: 'https://api.empresa.com/webhook',
        events: ['transfer.completed'],
      });

      const event = OutboxEvent.create({
        tenantId: mockTenant.getId(),
        eventType: 'transfer.completed',
        payload: { transactionId: 'tx-123' },
        maxAttempts: 3,
      });

      webhookRepo.findByTenantAndEvent.mockResolvedValue([endpoint]);

      // Mockeamos respuesta fallida 500
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const dispatcher = new OutboxDispatcherService(outboxRepo, webhookRepo);
      const success = await dispatcher.processSingleEvent(event);

      expect(success).toBe(false);
      expect(event.getStatus()).toBe(OutboxStatus.PENDING);
      expect(event.getAttempts()).toBe(1);
      expect(event.getNextRetryAt()).toBeDefined();
      expect(event.getLastError()).toContain('500');
      expect(outboxRepo.update).toHaveBeenCalledWith(event);
    });

    it('CA-HU-15-04: si se agotan los reintentos máximos, debe marcar el evento como FAILED', async () => {
      const endpoint = WebhookEndpoint.create({
        tenantId: mockTenant.getId(),
        url: 'https://api.empresa.com/webhook',
        events: ['transfer.completed'],
      });

      const event = OutboxEvent.create({
        tenantId: mockTenant.getId(),
        eventType: 'transfer.completed',
        payload: { transactionId: 'tx-123' },
        maxAttempts: 1, // Límite de 1 intento
      });

      webhookRepo.findByTenantAndEvent.mockResolvedValue([endpoint]);

      global.fetch = jest.fn().mockRejectedValue(new Error('Connection timed out'));

      const dispatcher = new OutboxDispatcherService(outboxRepo, webhookRepo);
      const success = await dispatcher.processSingleEvent(event);

      expect(success).toBe(false);
      expect(event.getStatus()).toBe(OutboxStatus.FAILED);
      expect(event.getAttempts()).toBe(1);
      expect(event.getLastError()).toContain('Connection timed out');
    });
  });
});
