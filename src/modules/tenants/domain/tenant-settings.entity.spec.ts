import { TenantSettings } from './entities/tenant-settings.entity';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { Currency } from './value-objects/currency.enum';
import { FeeType } from './value-objects/fee-type.enum';

describe('Tenant Financial Domain Rules (HU-02)', () => {
  describe('TenantSettings Entity', () => {
    it('debe crear configuración con valores por defecto válidos', () => {
      const settings = TenantSettings.createDefault('tenant-uuid-1');

      expect(settings.getTenantId()).toBe('tenant-uuid-1');
      expect(settings.getPrimaryCurrency()).toBe(Currency.COP);
      expect(settings.getMaxTransactionAmount()).toBe('50000000.00');
      expect(settings.getFeeType()).toBe(FeeType.FIXED);
      expect(settings.getFeeValue()).toBe('0.00');
    });

    it('CA-HU-02-01: debe permitir actualizar configuración válida', () => {
      const settings = TenantSettings.createDefault('tenant-uuid-1');

      settings.update({
        primaryCurrency: Currency.USD,
        maxTransactionAmount: '10000.00',
        feeType: FeeType.PERCENTAGE,
        feeValue: '2.5',
      });

      expect(settings.getPrimaryCurrency()).toBe(Currency.USD);
      expect(settings.getMaxTransactionAmount()).toBe('10000.00');
      expect(settings.getFeeType()).toBe(FeeType.PERCENTAGE);
      expect(settings.getFeeValue()).toBe('2.5');
    });

    it('CA-HU-02-03: debe rechazar comisión porcentual mayor a 100% o menor a 0%', () => {
      const settings = TenantSettings.createDefault('tenant-uuid-1');

      expect(() => {
        settings.update({
          primaryCurrency: Currency.COP,
          maxTransactionAmount: '50000.00',
          feeType: FeeType.PERCENTAGE,
          feeValue: '101.00',
        });
      }).toThrow('La comisión porcentual debe encontrarse dentro del rango permitido (0% a 100%).');

      expect(() => {
        settings.update({
          primaryCurrency: Currency.COP,
          maxTransactionAmount: '50000.00',
          feeType: FeeType.PERCENTAGE,
          feeValue: '-5.00',
        });
      }).toThrow();
    });

    it('debe rechazar límite máximo de transacción menor o igual a 0', () => {
      const settings = TenantSettings.createDefault('tenant-uuid-1');

      expect(() => {
        settings.update({
          primaryCurrency: Currency.COP,
          maxTransactionAmount: '0.00',
          feeType: FeeType.FIXED,
          feeValue: '1000.00',
        });
      }).toThrow('El límite máximo por transacción debe ser un número positivo estrictamente mayor a 0.');

      expect(() => {
        settings.update({
          primaryCurrency: Currency.COP,
          maxTransactionAmount: '-500.00',
          feeType: FeeType.FIXED,
          feeValue: '1000.00',
        });
      }).toThrow();
    });
  });

  describe('ExchangeRate Entity', () => {
    it('debe crear una tasa de cambio válida', () => {
      const rate = ExchangeRate.create({
        tenantId: 'tenant-uuid-1',
        fromCurrency: Currency.USD,
        toCurrency: Currency.COP,
        rate: '4050.25',
      });

      expect(rate.getFromCurrency()).toBe(Currency.USD);
      expect(rate.getToCurrency()).toBe(Currency.COP);
      expect(rate.getRate()).toBe('4050.25');
    });

    it('CA-HU-02-02: debe rechazar tasa de cambio igual a cero o negativa', () => {
      expect(() => {
        ExchangeRate.create({
          tenantId: 'tenant-uuid-1',
          fromCurrency: Currency.USD,
          toCurrency: Currency.COP,
          rate: '0',
        });
      }).toThrow('La tasa de cambio debe ser un valor numérico estrictamente mayor a 0.');

      expect(() => {
        ExchangeRate.create({
          tenantId: 'tenant-uuid-1',
          fromCurrency: Currency.USD,
          toCurrency: Currency.COP,
          rate: '-1.5',
        });
      }).toThrow();
    });

    it('debe rechazar un par con la misma divisa de origen y destino', () => {
      expect(() => {
        ExchangeRate.create({
          tenantId: 'tenant-uuid-1',
          fromCurrency: Currency.USD,
          toCurrency: Currency.USD,
          rate: '1.0',
        });
      }).toThrow('El par de divisas debe tener monedas origen y destino distintas.');
    });
  });
});

