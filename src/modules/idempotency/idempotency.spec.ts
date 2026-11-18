import { BadRequestException, ConflictException } from '@nestjs/common';
import { of } from 'rxjs';
import { IdempotencyService } from './application/services/idempotency.service';
import { IdempotencyInterceptor } from './presentation/interceptors/idempotency.interceptor';
import { CorrelationIdMiddleware } from './presentation/middleware/correlation-id.middleware';
import { IdempotencyRecord } from './domain/entities/idempotency-record.entity';
import { IdempotencyStatus } from './domain/value-objects/idempotency-status.enum';
import type { IdempotencyRepository } from './application/ports/idempotency.repository.port';

describe('Idempotency & Correlation (HU-10)', () => {
  let repository: jest.Mocked<IdempotencyRepository>;
  let service: IdempotencyService;

  beforeEach(() => {
    repository = {
      findByKey: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    service = new IdempotencyService(repository);
  });

  describe('IdempotencyService', () => {
    const tenantId = 'tnt-uuid-1';
    const userId = 'usr-uuid-1';
    const key = '11111111-2222-4333-8444-555555555555';
    const hash = 'abcdef1234567890';

    it('CA-HU-10-02: debe registrar una nueva clave en estado PROCESSING con expiración a 24 horas', async () => {
      const result = await service.acquireLock({
        tenantId,
        userId,
        key,
        requestHash: hash,
      });

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(result.isCached).toBe(false);
      expect(result.record).toBeDefined();
      expect(result.record!.getStatus()).toBe(IdempotencyStatus.PROCESSING);
      expect(result.record!.isExpired()).toBe(false);
    });

    it('CA-HU-10-03: debe retornar la respuesta cacheada si la operación ya finalizó con éxito (SUCCEEDED)', async () => {
      const existing = IdempotencyRecord.create({
        tenantId,
        userId,
        key,
        requestHash: hash,
      });
      existing.markSucceeded(200, JSON.stringify({ transferId: 'tx-999', amount: '100.00' }));
      repository.findByKey.mockResolvedValue(existing);

      const result = await service.acquireLock({
        tenantId,
        userId,
        key,
        requestHash: hash,
      });

      expect(result.isCached).toBe(true);
      expect(result.responseStatus).toBe(200);
      expect(result.responseBody).toEqual({ transferId: 'tx-999', amount: '100.00' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('CA-HU-10-04: debe lanzar ConflictException si se reutiliza la misma clave con un payload diferente', async () => {
      const existing = IdempotencyRecord.create({
        tenantId,
        userId,
        key,
        requestHash: 'hash-original',
      });
      repository.findByKey.mockResolvedValue(existing);

      await expect(
        service.acquireLock({
          tenantId,
          userId,
          key,
          requestHash: 'hash-completamente-diferente',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('CA-HU-10-05: debe lanzar ConflictException si la clave está en ejecución concurrente (PROCESSING)', async () => {
      const existing = IdempotencyRecord.create({
        tenantId,
        userId,
        key,
        requestHash: hash,
      });
      // Permanece en PROCESSING
      repository.findByKey.mockResolvedValue(existing);

      await expect(
        service.acquireLock({
          tenantId,
          userId,
          key,
          requestHash: hash,
        }),
      ).rejects.toThrow('La transacción financiera se encuentra actualmente en curso.');
    });
  });

  describe('IdempotencyInterceptor', () => {
    it('CA-HU-10-01: debe lanzar BadRequestException si falta el encabezado Idempotency-Key', () => {
      const reflector: any = {
        getAllAndOverride: jest.fn().mockReturnValue(true), // @Idempotent() activo
      };
      const interceptor = new IdempotencyInterceptor(reflector, service);

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {}, // Sin Idempotency-Key
          }),
          getResponse: () => ({}),
        }),
      };

      const next: any = { handle: () => of('ok') };

      expect(() => interceptor.intercept(mockContext, next)).toThrow(
        BadRequestException,
      );
    });

    it('debe lanzar BadRequestException si Idempotency-Key no tiene formato UUID', () => {
      const reflector: any = {
        getAllAndOverride: jest.fn().mockReturnValue(true),
      };
      const interceptor = new IdempotencyInterceptor(reflector, service);

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'idempotency-key': 'clave-no-uuid-invalida' },
          }),
          getResponse: () => ({}),
        }),
      };

      const next: any = { handle: () => of('ok') };

      expect(() => interceptor.intercept(mockContext, next)).toThrow(
        'El encabezado Idempotency-Key debe ser un UUID v4 válido.',
      );
    });
  });

  describe('CorrelationIdMiddleware', () => {
    it('debe propagar X-Correlation-ID recibido y agregarlo a la respuesta', () => {
      const middleware = new CorrelationIdMiddleware();
      const req: any = {
        headers: { 'x-correlation-id': 'custom-correlation-uuid-123' },
      };
      const res: any = {
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(req.correlationId).toBe('custom-correlation-uuid-123');
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        'custom-correlation-uuid-123',
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('debe generar un UUID si no se envió X-Correlation-ID', () => {
      const middleware = new CorrelationIdMiddleware();
      const req: any = { headers: {} };
      const res: any = { setHeader: jest.fn() };
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(req.correlationId).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-Correlation-ID',
        req.correlationId,
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

