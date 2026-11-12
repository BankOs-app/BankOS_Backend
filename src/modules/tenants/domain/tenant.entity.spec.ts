import { Tenant } from './entities/tenant.entity';
import { TenantStatus } from './value-objects/tenant-status.enum';
import { TenantSlug } from './value-objects/tenant-slug.vo';

describe('Tenant Domain Entity & Value Objects', () => {
  describe('TenantSlug Value Object', () => {
    it('debe crear un slug válido normalizado en minúsculas', () => {
      const slug = new TenantSlug('Banco-Union');
      expect(slug.getValue()).toBe('banco-union');
    });

    it('debe rechazar slugs con espacios o caracteres especiales no permitidos', () => {
      expect(() => new TenantSlug('banco union')).toThrow();
      expect(() => new TenantSlug('banco_union!')).toThrow();
      expect(() => new TenantSlug('-banco-')).toThrow();
    });

    it('debe rechazar slugs de menos de 3 caracteres o más de 50', () => {
      expect(() => new TenantSlug('ba')).toThrow();
      expect(() => new TenantSlug('a'.repeat(51))).toThrow();
    });
  });

  describe('Tenant Entity', () => {
    it('debe crear un nuevo tenant en estado PROVISIONING con schemaName seguro', () => {
      const tenant = Tenant.create('Banco Bogotá', 'banco-bogota');

      expect(tenant.getId()).toBeDefined();
      expect(tenant.getName()).toBe('Banco Bogotá');
      expect(tenant.getSlug().getValue()).toBe('banco-bogota');
      expect(tenant.getSchemaName()).toBe('tenant_banco_bogota');
      expect(tenant.getStatus()).toBe(TenantStatus.PROVISIONING);
      expect(tenant.canOperate()).toBe(false);
    });

    it('debe cambiar de estado a ACTIVE al invocar markAsActive()', () => {
      const tenant = Tenant.create('Cooperativa Central', 'coop-central');
      tenant.markAsActive();

      expect(tenant.getStatus()).toBe(TenantStatus.ACTIVE);
      expect(tenant.canOperate()).toBe(true);
    });

    it('debe cambiar de estado a FAILED al invocar markAsFailed()', () => {
      const tenant = Tenant.create('Fintech Express', 'fintech-express');
      tenant.markAsFailed();

      expect(tenant.getStatus()).toBe(TenantStatus.FAILED);
      expect(tenant.canOperate()).toBe(false);
    });

    it('debe rechazar nombres vacíos o menores a 3 caracteres', () => {
      expect(() => Tenant.create('', 'banco-demo')).toThrow();
      expect(() => Tenant.create('ab', 'banco-demo')).toThrow();
    });
  });
});

