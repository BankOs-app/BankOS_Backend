import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DepositUseCase } from './application/use-cases/deposit.use-case';
import { WithdrawUseCase } from './application/use-cases/withdraw.use-case';
import { PreviewTransferUseCase } from './application/use-cases/preview-transfer.use-case';
import { TransferUseCase } from './application/use-cases/transfer.use-case';
import { GetTransactionHistoryUseCase } from './application/use-cases/get-transaction-history.use-case';
import { GetTransactionDetailUseCase } from './application/use-cases/get-transaction-detail.use-case';
import { Tenant } from '../tenants/domain/entities/tenant.entity';
import { TenantSettings } from '../tenants/domain/entities/tenant-settings.entity';
import { ExchangeRate } from '../tenants/domain/entities/exchange-rate.entity';
import { Account } from '../accounts/domain/entities/account.entity';
import { Transaction } from './domain/entities/transaction.entity';
import { LedgerEntry } from '../ledger/domain/entities/ledger-entry.entity';
import { Currency } from '../tenants/domain/value-objects/currency.enum';
import { FeeType } from '../tenants/domain/value-objects/fee-type.enum';
import { TransactionType, LedgerEntryType } from './domain/value-objects/transaction-types.enum';
import { UserRole } from '../identity/domain/value-objects/user-role.enum';
import type { TenantRepository } from '../tenants/application/ports/tenant.repository.port';
import type { TenantSettingsRepository } from '../tenants/application/ports/tenant-settings.repository.port';
import type { ExchangeRateRepository } from '../tenants/application/ports/exchange-rate.repository.port';
import type { AccountRepository } from '../accounts/application/ports/account.repository.port';
import type { TransactionRepository } from './application/ports/transaction.repository.port';
import type { LedgerRepository } from '../ledger/application/ports/ledger.repository.port';

describe('Deposit Operations (HU-07)', () => {
  let tenantRepo: jest.Mocked<TenantRepository>;
  let settingsRepo: jest.Mocked<TenantSettingsRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let transactionRepo: jest.Mocked<TransactionRepository>;
  let ledgerRepo: jest.Mocked<LedgerRepository>;

  let mockTenant: Tenant;
  let mockSettings: TenantSettings;
  let mockAccount: Account;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco de Bogotá', 'banco-bogota');

    mockSettings = TenantSettings.createDefault(mockTenant.getId());
    mockSettings.update({
      primaryCurrency: Currency.COP,
      maxTransactionAmount: '10000000.00', // 10 millones COP de límite
      feeType: FeeType.FIXED,
      feeValue: '0.00',
    });

    mockAccount = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'cust-uuid-1',
      accountNumber: '1099887766',
      currency: Currency.COP,
      initialBalance: '50000.00',
    });

    tenantRepo = {
      findBySlug: jest.fn().mockResolvedValue(mockTenant),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockTenant),
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    };

    settingsRepo = {
      findByTenantId: jest.fn().mockResolvedValue(mockSettings),
      save: jest.fn(),
      update: jest.fn(),
    };

    accountRepo = {
      findByNumber: jest.fn().mockResolvedValue(mockAccount),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockAccount),
      listByCustomer: jest.fn().mockResolvedValue([mockAccount]),
      listByTenant: jest.fn().mockResolvedValue([mockAccount]),
    };

    transactionRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByTenant: jest.fn().mockResolvedValue([]),
      findByAccount: jest.fn().mockResolvedValue([]),
    };

    ledgerRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      listByTransaction: jest.fn().mockResolvedValue([]),
      listByAccount: jest.fn().mockResolvedValue([]),
    };
  });

  it('CA-HU-07-01: debe abonar fondos exitosamente incrementando el saldo y registrando ledger', async () => {
    const useCase = new DepositUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    const result = await useCase.execute({
      tenantSlug: 'banco-bogota',
      accountNumber: '1099887766',
      amount: '150000.00',
      idempotencyKey: 'key-uuid-1',
    });

    expect(accountRepo.update).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.save).toHaveBeenCalledTimes(1);

    expect(result.amount).toBe('150000.00');
    expect(result.currency).toBe(Currency.COP);
    expect(result.newBalance).toBe('200000.00'); // 50000 + 150000
    expect(result.accountNumber).toBe('1099887766');

    // Verificar datos de transacción guardada
    const savedTx = transactionRepo.save.mock.calls[0][0];
    expect(savedTx.getType()).toBe(TransactionType.DEPOSIT);
    expect(savedTx.getOriginalAmount()).toBe('150000.00');
  });

  it('CA-HU-07-02: debe rechazar depósitos con monto menor o igual a cero', async () => {
    const useCase = new DepositUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '0.00',
        idempotencyKey: 'key-uuid-2',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '-50.00',
        idempotencyKey: 'key-uuid-3',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(accountRepo.update).not.toHaveBeenCalled();
    expect(transactionRepo.save).not.toHaveBeenCalled();
  });

  it('CA-HU-07-03: debe rechazar depósitos sobre cuentas bloqueadas o inactivas (Soft Delete)', async () => {
    mockAccount.deactivate(); // Soft delete a INACTIVE

    const useCase = new DepositUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '1000.00',
        idempotencyKey: 'key-uuid-4',
      }),
    ).rejects.toThrow('No se permite depositar fondos en una cuenta en estado');

    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  it('debe rechazar depósitos que superen el límite máximo configurado por el tenant', async () => {
    const useCase = new DepositUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '15000000.00', // 15 millones (límite es 10 millones)
        idempotencyKey: 'key-uuid-5',
      }),
    ).rejects.toThrow('excede el límite máximo permitido');

    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException si la cuenta destino no existe', async () => {
    accountRepo.findByNumber.mockResolvedValue(null);

    const useCase = new DepositUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '9999999999',
        amount: '1000.00',
        idempotencyKey: 'key-uuid-6',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('Withdraw Operations (HU-08)', () => {
  let tenantRepo: jest.Mocked<TenantRepository>;
  let settingsRepo: jest.Mocked<TenantSettingsRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let transactionRepo: jest.Mocked<TransactionRepository>;
  let ledgerRepo: jest.Mocked<LedgerRepository>;

  let mockTenant: Tenant;
  let mockSettings: TenantSettings;
  let mockAccount: Account;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco de Bogotá', 'banco-bogota');

    mockSettings = TenantSettings.createDefault(mockTenant.getId());
    mockSettings.update({
      primaryCurrency: Currency.COP,
      maxTransactionAmount: '5000000.00', // 5 millones COP de límite
      feeType: FeeType.FIXED,
      feeValue: '0.00',
    });

    mockAccount = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'cust-uuid-1',
      accountNumber: '1099887766',
      currency: Currency.COP,
      initialBalance: '300000.00', // 300 mil COP de saldo inicial
    });

    tenantRepo = {
      findBySlug: jest.fn().mockResolvedValue(mockTenant),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockTenant),
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    };

    settingsRepo = {
      findByTenantId: jest.fn().mockResolvedValue(mockSettings),
      save: jest.fn(),
      update: jest.fn(),
    };

    accountRepo = {
      findByNumber: jest.fn().mockResolvedValue(mockAccount),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockAccount),
      listByCustomer: jest.fn().mockResolvedValue([mockAccount]),
      listByTenant: jest.fn().mockResolvedValue([mockAccount]),
    };

    transactionRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByTenant: jest.fn().mockResolvedValue([]),
      findByAccount: jest.fn().mockResolvedValue([]),
    };

    ledgerRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      listByTransaction: jest.fn().mockResolvedValue([]),
      listByAccount: jest.fn().mockResolvedValue([]),
    };
  });

  it('CA-HU-08-01: debe debitar fondos exitosamente reduciendo el saldo y registrando ledger (débito)', async () => {
    const useCase = new WithdrawUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    const result = await useCase.execute({
      tenantSlug: 'banco-bogota',
      accountNumber: '1099887766',
      amount: '100000.00',
      idempotencyKey: 'withdraw-key-1',
    });

    expect(accountRepo.update).toHaveBeenCalledTimes(1);
    expect(transactionRepo.save).toHaveBeenCalledTimes(1);
    expect(ledgerRepo.save).toHaveBeenCalledTimes(1);

    expect(result.amount).toBe('100000.00');
    expect(result.currency).toBe(Currency.COP);
    expect(result.newBalance).toBe('200000.00'); // 300000 - 100000
    expect(result.accountNumber).toBe('1099887766');

    // Verificar datos de transacción guardada
    const savedTx = transactionRepo.save.mock.calls[0][0];
    expect(savedTx.getType()).toBe(TransactionType.WITHDRAWAL);
    expect(savedTx.getOriginalAmount()).toBe('100000.00');
    expect(savedTx.getSourceAccountId()).toBe(mockAccount.getId());
  });

  it('CA-HU-08-02: debe rechazar retiros si el saldo es insuficiente sin modificar saldos', async () => {
    const useCase = new WithdrawUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '500000.00', // Saldo es 300 mil
        idempotencyKey: 'withdraw-key-2',
      }),
    ).rejects.toThrow('Saldo insuficiente para realizar el retiro');

    expect(accountRepo.update).not.toHaveBeenCalled();
    expect(transactionRepo.save).not.toHaveBeenCalled();
    expect(ledgerRepo.save).not.toHaveBeenCalled();
    expect(mockAccount.getBalance()).toBe('300000.00');
  });

  it('CA-HU-08-03: debe rechazar retiros con monto menor o igual a cero', async () => {
    const useCase = new WithdrawUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '0.00',
        idempotencyKey: 'withdraw-key-3',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '-20000.00',
        idempotencyKey: 'withdraw-key-4',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  it('debe rechazar retiros sobre cuentas bloqueadas o inactivas (Soft Delete)', async () => {
    mockAccount.block();

    const useCase = new WithdrawUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '50000.00',
        idempotencyKey: 'withdraw-key-5',
      }),
    ).rejects.toThrow('No se permite retirar fondos de una cuenta en estado');

    expect(accountRepo.update).not.toHaveBeenCalled();
  });

  it('debe rechazar retiros que superen el límite máximo configurado por el tenant', async () => {
    const useCase = new WithdrawUseCase(
      tenantRepo,
      settingsRepo,
      accountRepo,
      transactionRepo,
      ledgerRepo,
    );

    await expect(
      useCase.execute({
        tenantSlug: 'banco-bogota',
        accountNumber: '1099887766',
        amount: '6000000.00', // Límite es 5 millones
        idempotencyKey: 'withdraw-key-6',
      }),
    ).rejects.toThrow('excede el límite máximo permitido');

    expect(accountRepo.update).not.toHaveBeenCalled();
  });
});

describe('Transfer Operations (HU-09)', () => {
  let tenantRepo: jest.Mocked<TenantRepository>;
  let settingsRepo: jest.Mocked<TenantSettingsRepository>;
  let exchangeRateRepo: jest.Mocked<ExchangeRateRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let transactionRepo: jest.Mocked<TransactionRepository>;
  let ledgerRepo: jest.Mocked<LedgerRepository>;

  let mockTenant: Tenant;
  let mockSettings: TenantSettings;
  let sourceAccountCop: Account;
  let destAccountCop: Account;
  let sourceAccountUsd: Account;
  let destAccountCopFromUsd: Account;
  let mockUsdToCopRate: ExchangeRate;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco de Bogotá', 'banco-bogota');

    mockSettings = TenantSettings.createDefault(mockTenant.getId());
    mockSettings.update({
      primaryCurrency: Currency.COP,
      maxTransactionAmount: '10000000.00',
      feeType: FeeType.FIXED,
      feeValue: '2000.00', // 2000 COP de comisión fija
    });

    sourceAccountCop = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'cust-1',
      accountNumber: '1111111111',
      currency: Currency.COP,
      initialBalance: '500000.00',
    });

    destAccountCop = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'cust-2',
      accountNumber: '2222222222',
      currency: Currency.COP,
      initialBalance: '100000.00',
    });

    sourceAccountUsd = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'cust-1',
      accountNumber: '3333333333',
      currency: Currency.USD,
      initialBalance: '1000.00',
    });

    destAccountCopFromUsd = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'cust-3',
      accountNumber: '4444444444',
      currency: Currency.COP,
      initialBalance: '0.00',
    });

    // 1 USD = 4000 COP
    mockUsdToCopRate = ExchangeRate.create({
      tenantId: mockTenant.getId(),
      fromCurrency: Currency.USD,
      toCurrency: Currency.COP,
      rate: '4000.000000',
    });

    tenantRepo = {
      findBySlug: jest.fn().mockResolvedValue(mockTenant),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockTenant),
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    };

    settingsRepo = {
      findByTenantId: jest.fn().mockResolvedValue(mockSettings),
      save: jest.fn(),
      update: jest.fn(),
    };

    exchangeRateRepo = {
      findRate: jest.fn().mockImplementation((_tenantId, from, to) => {
        if (from === Currency.USD && to === Currency.COP) {
          return Promise.resolve(mockUsdToCopRate);
        }
        return Promise.resolve(null);
      }),
      listByTenantId: jest.fn().mockResolvedValue([mockUsdToCopRate]),
      saveOrUpdate: jest.fn(),
    };

    accountRepo = {
      findByNumber: jest.fn().mockImplementation((_tenantId, num) => {
        if (num === '1111111111') return Promise.resolve(sourceAccountCop);
        if (num === '2222222222') return Promise.resolve(destAccountCop);
        if (num === '3333333333') return Promise.resolve(sourceAccountUsd);
        if (num === '4444444444') return Promise.resolve(destAccountCopFromUsd);
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      listByCustomer: jest.fn().mockResolvedValue([]),
      listByTenant: jest.fn().mockResolvedValue([]),
    };

    transactionRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(null),
      findByTenant: jest.fn().mockResolvedValue([]),
      findByAccount: jest.fn().mockResolvedValue([]),
    };

    ledgerRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      listByTransaction: jest.fn().mockResolvedValue([]),
      listByAccount: jest.fn().mockResolvedValue([]),
    };
  });

  describe('PreviewTransferUseCase', () => {
    it('CA-HU-09-01: debe previsualizar transferencia en la misma moneda con comisión fija', async () => {
      const useCase = new PreviewTransferUseCase(
        tenantRepo,
        settingsRepo,
        exchangeRateRepo,
        accountRepo,
      );

      const preview = await useCase.execute({
        tenantSlug: 'banco-bogota',
        sourceAccountNumber: '1111111111',
        destinationAccountNumber: '2222222222',
        targetAmount: '100000.00',
      });

      expect(preview.targetAmount).toBe('100000.00');
      expect(preview.sourceEquivalentAmount).toBe('100000.00');
      expect(preview.feeAmount).toBe('2000.00');
      expect(preview.totalDebitAmount).toBe('102000.00');
      expect(preview.exchangeRateApplied).toBe('1.000000');
      expect(preview.sourceCurrency).toBe(Currency.COP);
      expect(preview.destinationCurrency).toBe(Currency.COP);
    });

    it('CA-HU-09-02: debe previsualizar transferencia multimoneda con tasa estática y comisión', async () => {
      mockSettings.update({
        primaryCurrency: Currency.USD,
        maxTransactionAmount: '50000.00',
        feeType: FeeType.PERCENTAGE,
        feeValue: '1.00',
      });

      const useCase = new PreviewTransferUseCase(
        tenantRepo,
        settingsRepo,
        exchangeRateRepo,
        accountRepo,
      );

      const preview = await useCase.execute({
        tenantSlug: 'banco-bogota',
        sourceAccountNumber: '3333333333',
        destinationAccountNumber: '4444444444',
        targetAmount: '400000.00',
      });

      expect(preview.targetAmount).toBe('400000.00');
      expect(preview.sourceEquivalentAmount).toBe('100.00');
      expect(preview.exchangeRateApplied).toBe('4000.000000');
      expect(preview.feeAmount).toBe('1.00');
      expect(preview.totalDebitAmount).toBe('101.00');
      expect(preview.sourceCurrency).toBe(Currency.USD);
      expect(preview.destinationCurrency).toBe(Currency.COP);
    });

    it('CA-HU-09-03: debe rechazar preview si la cuenta destino no existe en el tenant', async () => {
      const useCase = new PreviewTransferUseCase(
        tenantRepo,
        settingsRepo,
        exchangeRateRepo,
        accountRepo,
      );

      await expect(
        useCase.execute({
          tenantSlug: 'banco-bogota',
          sourceAccountNumber: '1111111111',
          destinationAccountNumber: '9999999999',
          targetAmount: '50000.00',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('TransferUseCase', () => {
    it('CA-HU-09-01 & CA-HU-09-05: debe ejecutar transferencia misma moneda, debitar origen, acreditar destino y registrar ledger', async () => {
      const useCase = new TransferUseCase(
        tenantRepo,
        settingsRepo,
        exchangeRateRepo,
        accountRepo,
        transactionRepo,
        ledgerRepo,
      );

      const result = await useCase.execute({
        tenantSlug: 'banco-bogota',
        sourceAccountNumber: '1111111111',
        destinationAccountNumber: '2222222222',
        targetAmount: '100000.00',
        idempotencyKey: 'transfer-key-1',
      });

      expect(accountRepo.update).toHaveBeenCalledTimes(2);
      expect(transactionRepo.save).toHaveBeenCalledTimes(1);
      expect(ledgerRepo.save).toHaveBeenCalledTimes(2);

      expect(result.targetAmount).toBe('100000.00');
      expect(result.feeAmount).toBe('2000.00');
      expect(result.totalDebited).toBe('102000.00');
      expect(sourceAccountCop.getBalance()).toBe('398000.00');
      expect(destAccountCop.getBalance()).toBe('200000.00');

      const savedTx = transactionRepo.save.mock.calls[0][0];
      expect(savedTx.getType()).toBe(TransactionType.TRANSFER);
      expect(savedTx.getOriginalAmount()).toBe('102000.00');
      expect(savedTx.getConvertedAmount()).toBe('100000.00');
    });

    it('CA-HU-09-02: debe ejecutar transferencia multimoneda con conversión y comisión porcentual', async () => {
      mockSettings.update({
        primaryCurrency: Currency.USD,
        maxTransactionAmount: '50000.00',
        feeType: FeeType.PERCENTAGE,
        feeValue: '2.00',
      });

      const useCase = new TransferUseCase(
        tenantRepo,
        settingsRepo,
        exchangeRateRepo,
        accountRepo,
        transactionRepo,
        ledgerRepo,
      );

      const result = await useCase.execute({
        tenantSlug: 'banco-bogota',
        sourceAccountNumber: '3333333333',
        destinationAccountNumber: '4444444444',
        targetAmount: '400000.00',
        idempotencyKey: 'transfer-key-2',
      });

      expect(result.sourceEquivalentAmount).toBe('100.00');
      expect(result.feeAmount).toBe('2.00');
      expect(result.totalDebited).toBe('102.00');
      expect(sourceAccountUsd.getBalance()).toBe('898.00');
      expect(destAccountCopFromUsd.getBalance()).toBe('400000.00');
    });

    it('CA-HU-09-04: debe rechazar transferencia si el saldo es insuficiente para monto + comisiones', async () => {
      const useCase = new TransferUseCase(
        tenantRepo,
        settingsRepo,
        exchangeRateRepo,
        accountRepo,
        transactionRepo,
        ledgerRepo,
      );

      await expect(
        useCase.execute({
          tenantSlug: 'banco-bogota',
          sourceAccountNumber: '1111111111',
          destinationAccountNumber: '2222222222',
          targetAmount: '600000.00',
          idempotencyKey: 'transfer-key-3',
        }),
      ).rejects.toThrow('Saldo insuficiente para transferir');

      expect(accountRepo.update).not.toHaveBeenCalled();
      expect(transactionRepo.save).not.toHaveBeenCalled();
      expect(sourceAccountCop.getBalance()).toBe('500000.00');
    });

    it('CA-HU-09-03: debe rechazar transferencia a cuenta destino que no pertenece al tenant', async () => {
      const useCase = new TransferUseCase(
        tenantRepo,
        settingsRepo,
        exchangeRateRepo,
        accountRepo,
        transactionRepo,
        ledgerRepo,
      );

      await expect(
        useCase.execute({
          tenantSlug: 'banco-bogota',
          sourceAccountNumber: '1111111111',
          destinationAccountNumber: '9999999999',
          targetAmount: '50000.00',
          idempotencyKey: 'transfer-key-4',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(accountRepo.update).not.toHaveBeenCalled();
    });
  });
});

describe('Transaction History & Detail (HU-11)', () => {
  let tenantRepo: jest.Mocked<TenantRepository>;
  let accountRepo: jest.Mocked<AccountRepository>;
  let transactionRepo: jest.Mocked<TransactionRepository>;
  let ledgerRepo: jest.Mocked<LedgerRepository>;

  let mockTenant: Tenant;
  let customerAccount1: Account;
  let customerAccount2: Account;
  let strangerAccount: Account;
  let sampleDepositTx: Transaction;
  let sampleTransferTx: Transaction;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco de Bogotá', 'banco-bogota');

    customerAccount1 = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'user-cust-1',
      accountNumber: '1111111111',
      currency: Currency.COP,
      initialBalance: '500000.00',
    });

    customerAccount2 = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'user-cust-1',
      accountNumber: '2222222222',
      currency: Currency.USD,
      initialBalance: '1000.00',
    });

    strangerAccount = Account.create({
      tenantId: mockTenant.getId(),
      customerId: 'user-cust-999',
      accountNumber: '9999999999',
      currency: Currency.COP,
      initialBalance: '20000.00',
    });

    sampleDepositTx = Transaction.createDeposit({
      tenantId: mockTenant.getId(),
      destinationAccountId: customerAccount1.getId(),
      amount: '50000.00',
      currency: Currency.COP,
      idempotencyKey: 'tx-key-1',
    });

    sampleTransferTx = Transaction.createTransfer({
      tenantId: mockTenant.getId(),
      sourceAccountId: customerAccount2.getId(),
      destinationAccountId: customerAccount1.getId(),
      originalAmount: '102.00',
      originalCurrency: Currency.USD,
      convertedAmount: '400000.00',
      destinationCurrency: Currency.COP,
      exchangeRateApplied: '4000.000000',
      feeAmount: '2.00',
      idempotencyKey: 'tx-key-2',
    });

    tenantRepo = {
      findBySlug: jest.fn().mockResolvedValue(mockTenant),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockTenant),
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    };

    accountRepo = {
      findByNumber: jest.fn().mockImplementation((_tenantId, num) => {
        if (num === '1111111111') return Promise.resolve(customerAccount1);
        if (num === '2222222222') return Promise.resolve(customerAccount2);
        if (num === '9999999999') return Promise.resolve(strangerAccount);
        return Promise.resolve(null);
      }),
      listByCustomer: jest.fn().mockImplementation((userId) => {
        if (userId === 'user-cust-1') {
          return Promise.resolve([customerAccount1, customerAccount2]);
        }
        return Promise.resolve([]);
      }),
      update: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      listByTenant: jest.fn().mockResolvedValue([customerAccount1, customerAccount2, strangerAccount]),
    };

    transactionRepo = {
      save: jest.fn(),
      findById: jest.fn().mockImplementation((id) => {
        if (id === sampleDepositTx.getId()) return Promise.resolve(sampleDepositTx);
        if (id === sampleTransferTx.getId()) return Promise.resolve(sampleTransferTx);
        return Promise.resolve(null);
      }),
      findByTenant: jest.fn(),
      findByAccount: jest.fn(),
      findPaginated: jest.fn().mockResolvedValue({
        data: [sampleDepositTx, sampleTransferTx],
        total: 2,
        page: 1,
        limit: 10,
      }),
    };

    ledgerRepo = {
      save: jest.fn(),
      listByTransaction: jest.fn().mockResolvedValue([
        LedgerEntry.create({
          tenantId: mockTenant.getId(),
          transactionId: sampleTransferTx.getId(),
          accountId: customerAccount2.getId(),
          type: LedgerEntryType.DEBIT,
          amount: '102.00',
          currency: Currency.USD,
        }),
      ]),
      listByAccount: jest.fn().mockResolvedValue([]),
    };
  });

  describe('GetTransactionHistoryUseCase', () => {
    it('CA-HU-11-01: cliente solo consulta operaciones de sus cuentas autorizadas', async () => {
      const useCase = new GetTransactionHistoryUseCase(
        tenantRepo,
        accountRepo,
        transactionRepo,
      );

      const result = await useCase.execute({
        tenantSlug: 'banco-bogota',
        userId: 'user-cust-1',
        role: UserRole.CUSTOMER,
        page: 1,
        limit: 10,
      });

      expect(accountRepo.listByCustomer).toHaveBeenCalledWith('user-cust-1');
      expect(transactionRepo.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockTenant.getId(),
          accountIds: [customerAccount1.getId(), customerAccount2.getId()],
          page: 1,
          limit: 10,
        }),
      );
      expect(result.total).toBe(2);
      expect(result.data.length).toBe(2);
    });

    it('CA-HU-11-04: debe incluir flags visuales hasFee y hasConversion en los items', async () => {
      const useCase = new GetTransactionHistoryUseCase(
        tenantRepo,
        accountRepo,
        transactionRepo,
      );

      const result = await useCase.execute({
        tenantSlug: 'banco-bogota',
        userId: 'user-cust-1',
        role: UserRole.CUSTOMER,
        page: 1,
        limit: 10,
      });

      const depositItem = result.data[0];
      const transferItem = result.data[1];

      expect(depositItem.hasFee).toBe(false);
      expect(depositItem.hasConversion).toBe(false);

      expect(transferItem.hasFee).toBe(true);
      expect(transferItem.hasConversion).toBe(true);
      expect(transferItem.feeAmount).toBe('2.00');
      expect(transferItem.exchangeRateApplied).toBe('4000.000000');
    });

    it('debe devolver lista vacía si el cliente no tiene cuentas registradas', async () => {
      const useCase = new GetTransactionHistoryUseCase(
        tenantRepo,
        accountRepo,
        transactionRepo,
      );

      const result = await useCase.execute({
        tenantSlug: 'banco-bogota',
        userId: 'user-sin-cuentas',
        role: UserRole.CUSTOMER,
        page: 1,
        limit: 10,
      });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(transactionRepo.findPaginated).not.toHaveBeenCalled();
    });
  });

  describe('GetTransactionDetailUseCase', () => {
    it('CA-HU-11-05: debe rechazar con 404 si un cliente intenta consultar una transacción ajena', async () => {
      const alienTx = Transaction.createDeposit({
        tenantId: mockTenant.getId(),
        destinationAccountId: strangerAccount.getId(),
        amount: '10000.00',
        currency: Currency.COP,
        idempotencyKey: 'alien-key',
      });
      transactionRepo.findById.mockResolvedValue(alienTx);

      const useCase = new GetTransactionDetailUseCase(
        tenantRepo,
        accountRepo,
        transactionRepo,
        ledgerRepo,
      );

      await expect(
        useCase.execute({
          tenantSlug: 'banco-bogota',
          transactionId: alienTx.getId(),
          userId: 'user-cust-1',
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe retornar el detalle financiero con asientos de Ledger para el cliente titular', async () => {
      const useCase = new GetTransactionDetailUseCase(
        tenantRepo,
        accountRepo,
        transactionRepo,
        ledgerRepo,
      );

      const detail = await useCase.execute({
        tenantSlug: 'banco-bogota',
        transactionId: sampleTransferTx.getId(),
        userId: 'user-cust-1',
        role: UserRole.CUSTOMER,
      });

      expect(detail.id).toBe(sampleTransferTx.getId());
      expect(detail.originalAmount).toBe('102.00');
      expect(detail.convertedAmount).toBe('400000.00');
      expect(detail.hasFee).toBe(true);
      expect(detail.hasConversion).toBe(true);
      expect(detail.ledgerEntries.length).toBe(1);
      expect(detail.ledgerEntries[0].amount).toBe('102.00');
    });
  });
});
