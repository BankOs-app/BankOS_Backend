import { randomUUID } from 'node:crypto';
import { UserRole } from '../value-objects/user-role.enum';
import { UserStatus } from '../value-objects/user-status.enum';

export interface UserProps {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entidad de Dominio: Usuario de la Plataforma dentro de un Tenant.
 */
export class User {
  private readonly id: string;
  private readonly tenantId: string;
  private readonly email: string;
  private role: UserRole;
  private status: UserStatus;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(props: UserProps) {
    this.validate(props);
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.email = props.email.trim().toLowerCase();
    this.role = props.role;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(params: {
    tenantId: string;
    email: string;
    role: UserRole;
  }): User {
    const now = new Date();
    return new User({
      id: randomUUID(),
      tenantId: params.tenantId,
      email: params.email,
      role: params.role,
      status: UserStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: UserProps): User {
    return new User(props);
  }

  public block(): void {
    this.status = UserStatus.BLOCKED;
    this.updatedAt = new Date();
  }

  public activate(): void {
    this.status = UserStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  public isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  private validate(props: UserProps): void {
    if (!props.tenantId) {
      throw new Error('El tenantId es obligatorio para el usuario.');
    }
    if (!props.email || !props.email.includes('@')) {
      throw new Error('El email del usuario no es válido.');
    }
    if (!Object.values(UserRole).includes(props.role)) {
      throw new Error(`Rol inválido: ${props.role}`);
    }
  }

  // Getters
  public getId(): string {
    return this.id;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public getEmail(): string {
    return this.email;
  }

  public getRole(): UserRole {
    return this.role;
  }

  public getStatus(): UserStatus {
    return this.status;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }
}

