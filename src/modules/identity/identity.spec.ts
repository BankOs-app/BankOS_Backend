import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { UserRole } from './domain/value-objects/user-role.enum';
import { AuthenticatedUser } from './domain/value-objects/authenticated-user.vo';
import { TenantMatchGuard } from './presentation/guards/tenant-match.guard';
import { RolesGuard } from './presentation/guards/roles.guard';

describe('Identity & Access Control (HU-03)', () => {
  let tokenService: JwtTokenService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService({
      JWT_SECRET: 'test_jwt_secret_bankos',
      KEYCLOAK_ISSUER: 'http://localhost:8080/realms/bankos',
      KEYCLOAK_AUDIENCE: 'bankos-api',
    });
    tokenService = new JwtTokenService(configService);
  });

  describe('JwtTokenService', () => {
    it('CA-HU-03-01: debe emitir y verificar un token con los claims obligatorios (tenant_id, user_id, role)', () => {
      const token = tokenService.generateToken({
        userId: 'usr-123',
        tenantId: 'tnt-456',
        tenantSlug: 'banco-bogota',
        email: 'cliente@bogota.com',
        role: UserRole.CUSTOMER,
      });

      const user = tokenService.verifyToken(token);

      expect(user.userId).toBe('usr-123');
      expect(user.tenantId).toBe('tnt-456');
      expect(user.tenantSlug).toBe('banco-bogota');
      expect(user.role).toBe(UserRole.CUSTOMER);
      expect(user.isCustomer()).toBe(true);
      expect(user.isAdmin()).toBe(false);
    });

    it('CA-HU-03-03: debe rechazar tokens con firma inválida o adulterada con UnauthorizedException', () => {
      const token = tokenService.generateToken({
        userId: 'usr-123',
        tenantId: 'tnt-456',
        tenantSlug: 'banco-bogota',
        email: 'cliente@bogota.com',
        role: UserRole.CUSTOMER,
      });

      // Modificamos el payload manualmente
      const parts = token.split('.');
      const forgedToken = `${parts[0]}.forgedpayload.${parts[2]}`;

      expect(() => tokenService.verifyToken(forgedToken)).toThrow(
        UnauthorizedException,
      );
    });

    it('CA-HU-03-03: debe rechazar tokens expirados con UnauthorizedException', () => {
      const expiredToken = tokenService.generateToken({
        userId: 'usr-123',
        tenantId: 'tnt-456',
        tenantSlug: 'banco-bogota',
        email: 'cliente@bogota.com',
        role: UserRole.CUSTOMER,
        expiresInSeconds: -10, // expiró hace 10 segundos
      });

      expect(() => tokenService.verifyToken(expiredToken)).toThrow(
        'El token de sesión ha expirado.',
      );
    });
  });

  describe('TenantMatchGuard (Aislamiento por Tenant)', () => {
    let guard: TenantMatchGuard;

    beforeEach(() => {
      guard = new TenantMatchGuard();
    });

    it('debe permitir acceso cuando el tenant del usuario coincide con el parámetro de la ruta', () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: new AuthenticatedUser(
              'usr-1',
              'tnt-1',
              'banco-bogota',
              'test@test.com',
              UserRole.ADMIN,
            ),
            params: { slug: 'banco-bogota' },
          }),
        }),
      };

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('CA-HU-03-02: debe responder 403 Forbidden cuando un usuario intenta acceder a otro tenant', () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: new AuthenticatedUser(
              'usr-1',
              'tnt-1',
              'banco-bogota',
              'test@test.com',
              UserRole.CUSTOMER,
            ),
            params: { slug: 'banco-santander' }, // ¡Otro tenant!
          }),
        }),
      };

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('RolesGuard (RBAC)', () => {
    it('debe bloquear con 403 a un usuario con rol customer que intente acción de admin', () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
      const guard = new RolesGuard(reflector);

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            user: new AuthenticatedUser(
              'usr-1',
              'tnt-1',
              'banco-bogota',
              'test@test.com',
              UserRole.CUSTOMER,
            ),
          }),
        }),
      };

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});

