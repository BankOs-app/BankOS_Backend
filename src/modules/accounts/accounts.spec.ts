import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateAccountUseCase } from './application/use-cases/create-account.use-case';
import { UpdateAccountStatusUseCase } from './application/use-cases/update-account-status.use-case';
import { Account } from './domain/entities/account.entity';
import { AccountStatus } from './domain/value-objects/account-status.enum';
import { Currency } from '../tenants/domain/value-objects/currency.enum';
import { Tenant } from '../tenants/domain/entities/tenant.entity';
import { Customer } from '../customers/domain/entities/customer.entity';
import type { TenantRepository } from '../tenants/application/ports/tenant.repository.port';
import type { CustomerRepository } from '../customers/application/ports/customer.repository.port';
import type { AccountRepository } from './application/ports/account.repository.port';

describe('Accounts Management & Soft Delete (HU-05)', () => {
  let tenantRepo: jest.Mocked<TenantRepository>;
  let customerRepo: jest.Mocked<CustomerRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let mockTenant: Tenant;
  let mockCustomer: Customer;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco Santander', 'banco-santander');
    mockCustomer = Customer.create({
      tenantId: mockTenant.getId(),
      userId: 'usr-santander-1',
      fullName: 'María Camila Gómez',
      documentNumber: '52345678',
      email: 'maria@santander.com',
    });

    tenantRepo = {
      findBySlug: jest.fn().mockResolvedValue(mockTenant),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockTenant),
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    };

    customerRepo = {
      findById: jest.fn().mockResolvedValue(mockCustomer),
      findByUserId: jest.fn().mockResolvedValue(mockCustomer),
      findByDocumentNumber: jest.fn().mockResolvedValue(null),
      listByTenant: jest.fn().mockResolvedValue([mockCustomer]),
      save: jest.fn(),
      update: jest.fn(),
    };

    accountRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByNumber: jest.fn().mockResolvedValue(null),
      listByCustomer: jest.fn().mockResolvedValue([]),
      listByTenant: jest.fn().mockResolvedValue([]),
    };
  });

  describe('Account Domain Entity & Soft Delete Rules', () => {
    it('debe crear una cuenta activa con saldo inicial', () => {
      const account = Account.create({
        tenantId: mockTenant.getId(),
        customerId: mockCustomer.getId(),
        accountNumber: '1001001001',
        currency: Currency.COP,
        initialBalance: '500000.00',
      });

      expect(account.getStatus()).toBe(AccountStatus.ACTIVE);
      expect(account.canTransact()).toBe(true);
      expect(account.getBalance()).toBe('500000.00');
    });

    it('CA-HU-05-04: no debe permitir operaciones financieras en una cuenta bloqueada o inactiva (Soft Delete)', () => {
      const account = Account.create({
        tenantId: mockTenant.getId(),
        customerId: mockCustomer.getId(),
        accountNumber: '1001001001',
        currency: Currency.COP,
        initialBalance: '1000.00',
      });

      // 1. Bloqueo
      account.block();
      expect(account.getStatus()).toBe(AccountStatus.BLOCKED);
      expect(account.canTransact()).toBe(false);
      expect(() => account.credit('500.00')).toThrow(
        "No se puede acreditar una cuenta en estado 'BLOCKED'",
      );
      expect(() => account.debit('200.00')).toThrow(
        "No se puede debitar una cuenta en estado 'BLOCKED'",
      );

      // 2. Borrado Lógico (Soft Delete)
      account.deactivate();
      expect(account.getStatus()).toBe(AccountStatus.INACTIVE);
      expect(account.canTransact()).toBe(false);
      expect(() => account.credit('500.00')).toThrow(
        "No se puede acreditar una cuenta en estado 'INACTIVE'",
      );
    });

    it('debe controlar el débito cuando el saldo es insuficiente', () => {
      const account = Account.create({
        tenantId: mockTenant.getId(),
        customerId: mockCustomer.getId(),
        accountNumber: '1001001001',
        currency: Currency.COP,
        initialBalance: '100.00',
      });

      expect(() => account.debit('150.00')).toThrow(
        'Saldo insuficiente para realizar el débito.',
      );
    });
  });

  describe('CreateAccountUseCase', () => {
    it('CA-HU-05-01: debe crear una cuenta bancaria activa asociada al cliente y tenant', async () => {
      const useCase = new CreateAccountUseCase(
        tenantRepo,
        customerRepo,
        accountRepo,
      );

      const result = await useCase.execute({
        tenantSlug: 'banco-santander',
        customerId: mockCustomer.getId(),
        currency: Currency.USD,
        accountNumber: '1099887766',
        initialBalance: '250.00',
      });

      expect(accountRepo.save).toHaveBeenCalledTimes(1);
      expect(result.accountNumber).toBe('1099887766');
      expect(result.currency).toBe(Currency.USD);
      expect(result.status).toBe(AccountStatus.ACTIVE);
      expect(result.maskedNumber).toBe('****7766');
    });

    it('CA-HU-05-02: debe rechazar la creación si el cliente pertenece a otro tenant', async () => {
      const customerFromOtherTenant = Customer.create({
        tenantId: 'otro-tenant-diferente',
        userId: 'usr-otro',
        fullName: 'Juan Pérez',
        documentNumber: '99887766',
        email: 'juan@otro.com',
      });
      customerRepo.findById.mockResolvedValue(customerFromOtherTenant);

      const useCase = new CreateAccountUseCase(
        tenantRepo,
        customerRepo,
        accountRepo,
      );

      await expect(
        useCase.execute({
          tenantSlug: 'banco-santander',
          customerId: customerFromOtherTenant.getId(),
          currency: Currency.COP,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it('CA-HU-05-03: debe rechazar con ConflictException si el número de cuenta ya existe en el tenant', async () => {
      const existingAccount = Account.create({
        tenantId: mockTenant.getId(),
        customerId: mockCustomer.getId(),
        accountNumber: '1099887766',
        currency: Currency.COP,
      });
      accountRepo.findByNumber.mockResolvedValue(existingAccount);

      const useCase = new CreateAccountUseCase(
        tenantRepo,
        customerRepo,
        accountRepo,
      );

      await expect(
        useCase.execute({
          tenantSlug: 'banco-santander',
          customerId: mockCustomer.getId(),
          currency: Currency.COP,
          accountNumber: '1099887766',
        }),
      ).rejects.toThrow(ConflictException);

      expect(accountRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('UpdateAccountStatusUseCase', () => {
    it('debe aplicar borrado lógico (Soft Delete) cambiando el estado a INACTIVE', async () => {
      const account = Account.create({
        tenantId: mockTenant.getId(),
        customerId: mockCustomer.getId(),
        accountNumber: '1099887766',
        currency: Currency.COP,
      });
      accountRepo.findByNumber.mockResolvedValue(account);

      const useCase = new UpdateAccountStatusUseCase(tenantRepo, accountRepo);
      const result = await useCase.execute(
        'banco-santander',
        '1099887766',
        AccountStatus.INACTIVE,
      );

      expect(accountRepo.update).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(AccountStatus.INACTIVE);
    });
  });
});

