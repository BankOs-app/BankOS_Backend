import { TenantSettings } from '../../domain/entities/tenant-settings.entity';

export const TENANT_SETTINGS_REPOSITORY = Symbol('TENANT_SETTINGS_REPOSITORY');

/**
 * Puerto de persistencia para la configuración financiera de cada Tenant.
 */
export interface TenantSettingsRepository {
  findByTenantId(tenantId: string): Promise<TenantSettings | null>;
  save(settings: TenantSettings): Promise<void>;
  update(settings: TenantSettings): Promise<void>;
}

