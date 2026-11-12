import { randomUUID } from 'node:crypto';
import { TenantStatus } from '../value-objects/tenant-status.enum';
import { TenantSlug } from '../value-objects/tenant-slug.vo';

export interface TenantProps {
  id: string;
  name: string;
  slug: TenantSlug;
  schemaName: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidad de Dominio que representa una institución financiera (Tenant).
 *
 * Principio de Arquitectura Limpia:
 * Esta clase no depende de ningún framework (NestJS), ORM (Drizzle) ni base de datos.
 * Contiene únicamente lógica pura de negocio y reglas de validación.
 */
export class Tenant {
  private readonly id: string;
  private name: string;
  private readonly slug: TenantSlug;
  private readonly schemaName: string;
  private status: TenantStatus;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: TenantProps) {
    this.validateName(props.name);
    this.id = props.id;
    this.name = props.name.trim();
    this.slug = props.slug;
    this.schemaName = props.schemaName;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Fábrica de dominio para crear un nuevo Tenant en estado inicial PROVISIONING.
   */
  public static create(name: string, rawSlug: string): Tenant {
    const slugVo = new TenantSlug(rawSlug);
    const id = randomUUID();

    // Generamos un nombre de esquema seguro para PostgreSQL:
    // Reemplazamos los guiones del slug por guiones bajos para que sea un identificador SQL válido.
    const safeSchemaName = `tenant_${slugVo.getValue().replace(/-/g, '_')}`;

    const now = new Date();
    return new Tenant({
      id,
      name,
      slug: slugVo,
      schemaName: safeSchemaName,
      status: TenantStatus.PROVISIONING,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstruye una entidad desde la base de datos (persistencia).
   */
  public static reconstitute(props: {
    id: string;
    name: string;
    slug: string;
    schemaName: string;
    status: TenantStatus;
    createdAt: Date;
    updatedAt: Date;
  }): Tenant {
    return new Tenant({
      id: props.id,
      name: props.name,
      slug: new TenantSlug(props.slug),
      schemaName: props.schemaName,
      status: props.status,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    });
  }

  /**
   * Marca el tenant como activo una vez aprovisionado su esquema.
   */
  public markAsActive(): void {
    if (this.status === TenantStatus.ACTIVE) {
      return;
    }
    this.status = TenantStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Marca el tenant como fallido si ocurre algún error durante el aprovisionamiento.
   */
  public markAsFailed(): void {
    this.status = TenantStatus.FAILED;
    this.updatedAt = new Date();
  }

  public canOperate(): boolean {
    return this.status === TenantStatus.ACTIVE;
  }

  private validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('El nombre de la institución es obligatorio');
    }
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 100) {
      throw new Error('El nombre de la institución debe tener entre 3 y 100 caracteres');
    }
  }

  // Getters para consultar propiedades sin permitir mutación directa
  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getSlug(): TenantSlug {
    return this.slug;
  }

  public getSchemaName(): string {
    return this.schemaName;
  }

  public getStatus(): TenantStatus {
    return this.status;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

