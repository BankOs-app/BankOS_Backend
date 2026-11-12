import { Test, TestingModule } from '@nestjs/testing';
import { TenantSettingsController } from './tenant-settings.controller';
import { GetTenantSettingsUseCase } from '../../application/use-cases/get-tenant-settings.use-case';
import { UpdateTenantSettingsUseCase } from '../../application/use-cases/update-tenant-settings.use-case';
import { SetExchangeRateUseCase } from '../../application/use-cases/set-exchange-rate.use-case';
import { GetExchangeRatesUseCase } from '../../application/use-cases/get-exchange-rates.use-case';
import { Currency } from '../../domain/value-objects/currency.enum';
import { FeeType } from '../../domain/value-objects/fee-type.enum';
import { TenantSettingsResponseDto } from '../../application/dto/tenant-settings-response.dto';
import { ExchangeRateResponseDto } from '../../application/dto/exchange-rate-response.dto';

describe('TenantSettingsController', () => {
  let controller: TenantSettingsController;
  let getTenantSettingsUseCase: jest.Mocked<GetTenantSettingsUseCase>;
  let updateTenantSettingsUseCase: jest.Mocked<UpdateTenantSettingsUseCase>;
  let setExchangeRateUseCase: jest.Mocked<SetExchangeRateUseCase>;
  let getExchangeRatesUseCase: jest.Mocked<GetExchangeRatesUseCase>;

  beforeEach(async () => {
    getTenantSettingsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetTenantSettingsUseCase>;

    updateTenantSettingsUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<UpdateTenantSettingsUseCase>;

    setExchangeRateUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SetExchangeRateUseCase>;

    getExchangeRatesUseCase = {
      listAll: jest.fn(),
      findPair: jest.fn(),
    } as unknown as jest.Mocked<GetExchangeRatesUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantSettingsController],
      providers: [
        {
          provide: GetTenantSettingsUseCase,
          useValue: getTenantSettingsUseCase,
        },
        {
          provide: UpdateTenantSettingsUseCase,
          useValue: updateTenantSettingsUseCase,
        },
        {
          provide: SetExchangeRateUseCase,
          useValue: setExchangeRateUseCase,
        },
        {
          provide: GetExchangeRatesUseCase,
          useValue: getExchangeRatesUseCase,
        },
      ],
    }).compile();

    controller = module.get<TenantSettingsController>(TenantSettingsController);
  });

  it('debe consultar la configuración del tenant', async () => {
    const mockDto: TenantSettingsResponseDto = {
      id: 'settings-1',
      tenantId: 'tenant-1',
      primaryCurrency: Currency.COP,
      maxTransactionAmount: '50000000.00',
      feeType: FeeType.FIXED,
      feeValue: '0.00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getTenantSettingsUseCase.execute.mockResolvedValue(mockDto);

    const result = await controller.getSettings('banco-demo');
    expect(getTenantSettingsUseCase.execute).toHaveBeenCalledWith('banco-demo');
    expect(result).toEqual(mockDto);
  });

  it('debe actualizar la configuración del tenant', async () => {
    const mockDto: TenantSettingsResponseDto = {
      id: 'settings-1',
      tenantId: 'tenant-1',
      primaryCurrency: Currency.USD,
      maxTransactionAmount: '20000.00',
      feeType: FeeType.PERCENTAGE,
      feeValue: '1.5',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateTenantSettingsUseCase.execute.mockResolvedValue(mockDto);

    const result = await controller.updateSettings('banco-demo', {
      primaryCurrency: Currency.USD,
      maxTransactionAmount: '20000.00',
      feeType: FeeType.PERCENTAGE,
      feeValue: '1.5',
    });

    expect(updateTenantSettingsUseCase.execute).toHaveBeenCalledWith({
      slug: 'banco-demo',
      primaryCurrency: Currency.USD,
      maxTransactionAmount: '20000.00',
      feeType: FeeType.PERCENTAGE,
      feeValue: '1.5',
    });
    expect(result).toEqual(mockDto);
  });

  it('debe registrar una tasa de cambio', async () => {
    const mockDto: ExchangeRateResponseDto = {
      id: 'rate-1',
      tenantId: 'tenant-1',
      fromCurrency: Currency.USD,
      toCurrency: Currency.COP,
      rate: '4000.00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setExchangeRateUseCase.execute.mockResolvedValue(mockDto);

    const result = await controller.setExchangeRate('banco-demo', {
      fromCurrency: Currency.USD,
      toCurrency: Currency.COP,
      rate: '4000.00',
    });

    expect(setExchangeRateUseCase.execute).toHaveBeenCalledWith({
      slug: 'banco-demo',
      fromCurrency: Currency.USD,
      toCurrency: Currency.COP,
      rate: '4000.00',
    });
    expect(result).toEqual(mockDto);
  });
});

