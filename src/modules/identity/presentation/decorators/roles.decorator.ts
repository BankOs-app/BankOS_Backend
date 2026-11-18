import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../domain/value-objects/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir endpoints a roles específicos (admin, customer).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

