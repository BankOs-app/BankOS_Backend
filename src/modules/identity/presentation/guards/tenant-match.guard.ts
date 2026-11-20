import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../domain/value-objects/authenticated-user.vo';
import { UserRole } from '../../domain/value-objects/user-role.enum';

/**
 * Guard de Aislamiento Estricto por Tenant.
 *
 * Criterio CA-HU-03-02:
 * "Given un usuario autenticado que no pertenece al tenant indicado,
 * When solicita un recurso, Then BankOS responde prohibido y no revela datos de otros tenants."
 */
@Injectable()
export class TenantMatchGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    const tenantSlugParam = request.params.slug;

    if (!tenantSlugParam || !user) {
      return true;
    }

    // Administrador General: acceso institucional a todas las entidades del sistema
    const isGlobalAdmin = user.role === UserRole.SUPER_ADMIN;

    if (isGlobalAdmin) {
      return true;
    }

    const paramLower = tenantSlugParam.trim().toLowerCase();
    const matchesSlug =
      user.tenantSlug && user.tenantSlug.toLowerCase() === paramLower;
    const matchesId =
      user.tenantId && user.tenantId.toLowerCase() === paramLower;

    if (!matchesSlug && !matchesId) {
      throw new ForbiddenException(
        `Violación de aislamiento multitenant: el usuario pertenece al tenant '${user.tenantSlug || user.tenantId}' y no tiene autorización para operar en '${tenantSlugParam}'.`,
      );
    }

    return true;
  }
}

