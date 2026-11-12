import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateTenantSettingsUseCase } from './update-tenant-settings.use-case';
import { SetExchangeRateUseCase } from './set-exchange-rate.use-case';
import { GetExchangeRatesUseCase } from './get-exchange-rates.use-case';
import { Tenant } from '../../domain/entities/tenant.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';
import type { TenantRepository } from '../ports/tenant.repository.port';
import type { TenantSettingsRepository } from '../ports/tenant-settings.repository.port';
import type { ExchangeRateRepository } from '../ports/exchange-rate.repository.port';
import { ExchangeRate } from '../../domain/entities/exchange-rate.entity';

describe('Tenant Financial Settings Use Cases (HU-02)', () => {
  let tenantRepo: jest.Mocked<TenantRepository>;
  let settingsRepo: jest.Mocked<TenantSettingsRepository>;
  let exchangeRateRepo: jest.Mocked<ExchangeRateRepository>;
  let mockTenant: Tenant;

  beforeEach(() => {
    mockTenant = Tenant.create('Banco de Prueba', 'banco-prueba');
    mockTenant.markAsActive();

    tenantRepo = {
      findBySlug: jest.fn().mockResolvedValue(mockTenant),
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn().mockResolvedValue(mockTenant),
      findAll: jest.fn().mockResolvedValue([mockTenant]),
    };

    settingsRepo = {
      findByTenantId: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };

    exchangeRateRepo = {
      findRate: jest.fn().mockResolvedValue(null),
      listByTenantId: jest.fn().mockResolvedValue([]),
      saveOrUpdate: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('UpdateTenantSettingsUseCase', () => {
    it('CA-HU-02-01: debe actualizar la configuración financiera del tenant correctamente', async () => {
      const useCase = new UpdateTenantSettingsUseCase(tenantRepo, settingsRepo);

      const result = await useCase.execute({
        slug: 'banco-prueba',
        primaryCurrency: Currency.USD,
        maxTransactionAmount: '20000.00',
        feeType: FeeType.PERCENTAGE,
        feeValue: '1.75',
      });

      expect(tenantRepo.findBySlug).toHaveBeenCalledWith('banco-prueba');
      expect(settingsRepo.update).toHaveBeenCalledTimes(1);
      expect(result.primaryCurrency).toBe(Currency.USD);
      expect(result.maxTransactionAmount).toBe('20000.00');
      expect(result.feeType).toBe(FeeType.PERCENTAGE);
      expect(result.feeValue).toBe('1.75');
    });

    it('CA-HU-02-03: debe rechazar comisión porcentual inválida con BadRequestException', async () => {
      const useCase = new UpdateTenantSettingsUseCase(tenantRepo, settingsRepo);

      await expect(
        useCase.execute({
          slug: 'banco-prueba',
          primaryCurrency: Currency.COP,
          maxTransactionAmount: '500000.00',
          feeType: FeeType.PERCENTAGE,
          feeValue: '150.00', // Inválido: > 100%
        }),
      ).rejects.toThrow(BadRequestException);

      expect(settingsRepo.update).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el tenant no existe', async () => {
      tenantRepo.findBySlug.mockResolvedValue(null);
      const useCase = new UpdateTenantSettingsUseCase(tenantRepo, settingsRepo);

      await expect(
        useCase.execute({
          slug: 'no-existe',
          primaryCurrency: Currency.COP,
          maxTransactionAmount: '100.00',
          feeType: FeeType.FIXED,
          feeValue: '0.00',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('SetExchangeRateUseCase', () => {
    it('debe registrar o actualizar una tasa de cambio válida', async () => {
      const useCase = new SetExchangeRateUseCase(tenantRepo, exchangeRateRepo);

      const result = await useCase.execute({
        slug: 'banco-prueba',
        fromCurrency: Currency.USD,
        toCurrency: Currency.COP,
        rate: '4120.50',
      });

      expect(exchangeRateRepo.saveOrUpdate).toHaveBeenCalledTimes(1);
      expect(result.fromCurrency).toBe(Currency.USD);
      expect(result.toCurrency).toBe(Currency.COP);
      expect(result.rate).toBe('4120.50');
    });

    it('CA-HU-02-02: debe rechazar tasa cero o negativa con BadRequestException', async () => {
      const useCase = new SetExchangeRateUseCase(tenantRepo, exchangeRateRepo);

      await expect(
        useCase.execute({
          slug: 'banco-prueba',
          fromCurrency: Currency.USD,
          toCurrency: Currency.COP,
          rate: '0',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          slug: 'banco-prueba',
          fromCurrency: Currency.USD,
          toCurrency: Currency.COP,
          rate: '-500',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(exchangeRateRepo.saveOrUpdate).not.toHaveBeenCalled();
    });
  });

  describe('GetExchangeRatesUseCase', () => {
    it('debe consultar la tasa específica de un par', async () => {
      const existingRate = ExchangeRate.create({
        tenantId: mockTenant.getId(),
        fromCurrency: Currency.USD,
        toCurrency: Currency.COP,
        rate: '4000.00',
      });
      exchangeRateRepo.findRate.mockResolvedValue(existingRate);

      const useCase = new GetExchangeRatesUseCase(tenantRepo, exchangeRateRepo);
      const result = await useCase.findPair('banco-prueba', 'USD', 'COP');

      expect(result.fromCurrency).toBe(Currency.USD);
      expect(result.toCurrency).toBe(Currency.COP);
      expect(result.rate).toBe('4000.00');
    });

    it('debe lanzar NotFoundException si no existe tasa para ese par', async () => {
      exchangeRateRepo.findRate.mockResolvedValue(null);

      const useCase = new GetExchangeRatesUseCase(tenantRepo, exchangeRateRepo);
      await expect(
        useCase.findPair('banco-prueba', 'EUR', 'COP'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

