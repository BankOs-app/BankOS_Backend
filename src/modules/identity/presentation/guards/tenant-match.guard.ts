import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../domain/value-objects/authenticated-user.vo';

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

    if (user.tenantSlug && user.tenantSlug.toLowerCase() !== tenantSlugParam.toLowerCase()) {
      throw new ForbiddenException(
        `Violación de aislamiento multitenant: el usuario pertenece al tenant '${user.tenantSlug}' y no tiene autorización para operar en '${tenantSlugParam}'.`,
      );
    }

    return true;
  }
}

