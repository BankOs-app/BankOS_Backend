import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateCustomerUseCase } from './application/use-cases/create-customer.use-case';
import { GetCustomerUseCase } from './application/use-cases/get-customer.use-case';
import { Tenant } from '../tenants/domain/entities/tenant.entity';
import { Customer } from './domain/entities/customer.entity';
import type { TenantRepository } from '../tenants/application/ports/tenant.repository.port';
import type { UserRepository } from '../identity/application/ports/user.repository.port';
import type { CustomerRepository } from './application/ports/customer.repository.port';

describe('Customers & User Management (HU-04)', () => {
  let tenantRepo: jest.Mocked<TenantRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let customerRepo: jest.Mocked<CustomerRepository>;
  let mockTenant: Tenant;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco de Bogotá', 'banco-bogota');

    tenantRepo = {
      findBySlug: jest.fn().mockResolvedValue(mockTenant),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockTenant),
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    };

    userRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      listByTenant: jest.fn().mockResolvedValue([]),
    };

    customerRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn().mockResolvedValue(null),
      findByDocumentNumber: jest.fn().mockResolvedValue(null),
      listByTenant: jest.fn().mockResolvedValue([]),
    };
  });

  describe('CreateCustomerUseCase', () => {
    it('CA-HU-04-01: debe registrar el cliente y crear el usuario vinculado', async () => {
      const useCase = new CreateCustomerUseCase(
        tenantRepo,
        userRepo,
        customerRepo,
      );

      const result = await useCase.execute({
        tenantSlug: 'banco-bogota',
        fullName: 'Carlos Alberto Rodríguez',
        documentNumber: '1020304050',
        email: 'carlos@email.com',
        phone: '+573001234567',
      });

      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(customerRepo.save).toHaveBeenCalledTimes(1);
      expect(result.fullName).toBe('Carlos Alberto Rodríguez');
      expect(result.documentNumber).toBe('1020304050');
      expect(result.email).toBe('carlos@email.com');
      expect(result.userId).toBeDefined();
    });

    it('debe rechazar registro si el documento ya existe en el tenant con ConflictException', async () => {
      const existingCustomer = Customer.create({
        tenantId: mockTenant.getId(),
        userId: 'usr-1',
        fullName: 'Otro Cliente',
        documentNumber: '1020304050',
        email: 'otro@email.com',
      });
      customerRepo.findByDocumentNumber.mockResolvedValue(existingCustomer);

      const useCase = new CreateCustomerUseCase(
        tenantRepo,
        userRepo,
        customerRepo,
      );

      await expect(
        useCase.execute({
          tenantSlug: 'banco-bogota',
          fullName: 'Carlos Rodríguez',
          documentNumber: '1020304050',
          email: 'carlos@email.com',
        }),
      ).rejects.toThrow(ConflictException);

      expect(userRepo.save).not.toHaveBeenCalled();
      expect(customerRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('GetCustomerUseCase', () => {
    it('CA-HU-04-04: si un cliente pertenece a otro tenant, debe responder NotFoundException sin revelar información', async () => {
      const customerFromOtherTenant = Customer.create({
        tenantId: 'otro-tenant-id-diferente',
        userId: 'usr-2',
        fullName: 'Cliente de Otro Banco',
        documentNumber: '99887766',
        email: 'otro@banco.com',
      });
      customerRepo.findById.mockResolvedValue(customerFromOtherTenant);

      const useCase = new GetCustomerUseCase(tenantRepo, customerRepo);

      await expect(
        useCase.findById('banco-bogota', customerFromOtherTenant.getId()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

