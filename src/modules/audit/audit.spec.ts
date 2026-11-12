import { NotFoundException } from '@nestjs/common';
import { RecordAuditLogUseCase } from './application/use-cases/record-audit-log.use-case';
import { GetAuditLogsUseCase } from './application/use-cases/get-audit-logs.use-case';
import { AuditLog } from './domain/entities/audit-log.entity';
import { AuditAction } from './domain/value-objects/audit-action.enum';
import { Tenant } from '../tenants/domain/entities/tenant.entity';
import type { AuditLogRepository } from './application/ports/audit-log.repository.port';
import type { TenantRepository } from '../tenants/application/ports/tenant.repository.port';

describe('Audit Administrative Actions (HU-14)', () => {
  let auditRepo: jest.Mocked<AuditLogRepository>;
  let tenantRepo: jest.Mocked<TenantRepository>;
  let mockTenant: Tenant;
  let mockOtherTenant: Tenant;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco de Bogotá', 'banco-bogota');
    mockOtherTenant = Tenant.create('Banco Santander', 'banco-santander');

    auditRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findPaginated: jest.fn(),
    };

    tenantRepo = {
      findBySlug: jest.fn().mockImplementation((slug) => {
        if (slug === 'banco-bogota') return Promise.resolve(mockTenant);
        if (slug === 'banco-santander') return Promise.resolve(mockOtherTenant);
        return Promise.resolve(null);
      }),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    };
  });

  describe('RecordAuditLogUseCase (CA-HU-14-01)', () => {
    it('debe registrar exitosamente un evento de auditoría con actor, acción, recurso y valores', async () => {
      const useCase = new RecordAuditLogUseCase(auditRepo);

      const log = await useCase.execute({
        tenantId: mockTenant.getId(),
        actorId: 'admin-user-1',
        action: AuditAction.UPDATE_SETTINGS,
        resource: 'tenant_settings',
        resourceId: mockTenant.getId(),
        previousValues: { feeValue: '1000.00', feeType: 'FIXED' },
        newValues: { feeValue: '2500.00', feeType: 'FIXED' },
        correlationId: 'corr-id-12345',
      });

      expect(auditRepo.save).toHaveBeenCalledTimes(1);
      expect(log.getActorId()).toBe('admin-user-1');
      expect(log.getAction()).toBe(AuditAction.UPDATE_SETTINGS);
      expect(log.getResource()).toBe('tenant_settings');
      expect(log.getPreviousValues()).toEqual({ feeValue: '1000.00', feeType: 'FIXED' });
      expect(log.getNewValues()).toEqual({ feeValue: '2500.00', feeType: 'FIXED' });
      expect(log.getCorrelationId()).toBe('corr-id-12345');
    });

    it('debe ofuscar y sanitizar contraseñas, tokens y secretos de los valores auditados', async () => {
      const useCase = new RecordAuditLogUseCase(auditRepo);

      const log = await useCase.execute({
        tenantId: mockTenant.getId(),
        actorId: 'admin-user-1',
        action: AuditAction.CREATE_CUSTOMER,
        resource: 'users',
        resourceId: 'user-new-1',
        previousValues: null,
        newValues: {
          email: 'test@banco.com',
          secretKey: 'my-super-secret-value',
          userPassword: 'plaintext-pass',
        },
      });

      const newValues = log.getNewValues() as Record<string, unknown>;
      expect(newValues.email).toBe('test@banco.com');
      expect(newValues.secretKey).toBe('***REDACTED***');
      expect(newValues.userPassword).toBe('***REDACTED***');
    });
  });

  describe('GetAuditLogsUseCase & Tenant Isolation (CA-HU-14-04)', () => {
    it('CA-HU-14-04: debe aislar las consultas y solo retornar auditoría del tenant consultado', async () => {
      const mockLog = AuditLog.create({
        tenantId: mockTenant.getId(),
        actorId: 'admin-1',
        action: AuditAction.UPDATE_SETTINGS,
        resource: 'tenant_settings',
        resourceId: mockTenant.getId(),
      });

      auditRepo.findPaginated.mockResolvedValue({
        data: [mockLog],
        total: 1,
        page: 1,
        limit: 10,
      });

      const useCase = new GetAuditLogsUseCase(tenantRepo, auditRepo);

      const result = await useCase.execute({
        tenantSlug: 'banco-bogota',
        page: 1,
        limit: 10,
      });

      expect(auditRepo.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenant.getId(),
          page: 1,
          limit: 10,
        }),
      );
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe(mockLog.getId());
    });

    it('debe lanzar NotFoundException si el tenant consultado no existe', async () => {
      const useCase = new GetAuditLogsUseCase(tenantRepo, auditRepo);

      await expect(
        useCase.execute({
          tenantSlug: 'tenant-fantasma',
          page: 1,
          limit: 10,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(auditRepo.findPaginated).not.toHaveBeenCalled();
    });
  });

  describe('Inmutabilidad de Dominio (CA-HU-14-03)', () => {
    it('CA-HU-14-03: la entidad AuditLog no expone métodos para modificar su estado', () => {
      const log = AuditLog.create({
        tenantId: mockTenant.getId(),
        actorId: 'admin-1',
        action: AuditAction.UPDATE_ACCOUNT_STATUS,
        resource: 'accounts',
        resourceId: 'acc-uuid-1',
      });

      // Validar que solo existen getters inmutables
      expect(typeof log.getId).toBe('function');
      expect(typeof log.getActorId).toBe('function');
      expect(typeof log.getCreatedAt).toBe('function');
      expect((log as unknown as Record<string, unknown>).update).toBeUndefined();
      expect((log as unknown as Record<string, unknown>).delete).toBeUndefined();
    });
  });
});

