import { Tenant } from '../../domain/entities/tenant.entity';

export const TENANT_REPOSITORY = Symbol('TENANT_REPOSITORY');

/**
 * Puerto (Contrato) de persistencia para Tenants.
 *
 * En Clean Architecture / Hexagonal, la capa de aplicación define qué necesita
 * de la persistencia mediante interfaces, y la capa de infraestructura lo implementa.
 */
export interface TenantRepository {
  /**
   * Guarda un nuevo tenant en la base de datos central.
   */
  save(tenant: Tenant): Promise<void>;

  /**
   * Actualiza el estado y datos de un tenant existente.
   */
  update(tenant: Tenant): Promise<void>;

  /**
   * Busca un tenant por su slug único.
   */
  findBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Busca un tenant por su identificador UUID único.
   */
  findById(id: string): Promise<Tenant | null>;

  /**
   * Retorna todos los tenants registrados.
   */
  findAll(): Promise<Tenant[]>;
}

