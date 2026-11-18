import { UserRole } from './user-role.enum';

/**
 * Value Object que representa al usuario autenticado y validado por el backend.
 *
 * Contiene los claims obligatorios según la especificación:
 * tenant_id, user_id y role.
 */
export class AuthenticatedUser {
  constructor(
    public readonly userId: string,
    public readonly tenantId: string,
    public readonly tenantSlug: string,
    public readonly email: string,
    public readonly role: UserRole,
  ) {}

  public isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  public isCustomer(): boolean {
    return this.role === UserRole.CUSTOMER;
  }

  public belongsToTenant(tenantId: string): boolean {
    return this.tenantId === tenantId;
  }
}

