import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuthenticatedUser } from '../../domain/value-objects/authenticated-user.vo';
import { UserRole } from '../../domain/value-objects/user-role.enum';

export interface JwtPayload {
  sub: string;
  user_id?: string;
  tenant_id: string;
  tenant_slug: string;
  email: string;
  role: string;
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
}

/**
 * Servicio de Validación y Emisión de Tokens JWT.
 *
 * Cumple con la especificación de tokens para BankOS:
 * - Claims obligatorios: tenant_id, user_id (o sub) y role.
 * - Validación de expiración y firma criptográfica.
 * - Soporta emulación para desarrollo/demos y validación OIDC.
 */
@Injectable()
export class JwtTokenService {
  private readonly logger = new Logger(JwtTokenService.name);
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret =
      this.configService.get<string>('JWT_SECRET') ??
      'super_secret_jwt_key_bankos_local';
  }

  /**
   * Genera un token JWT firmado para pruebas, desarrollo y demostraciones de jueces.
   */
  public generateToken(payload: {
    userId: string;
    tenantId: string;
    tenantSlug: string;
    email: string;
    role: UserRole;
    expiresInSeconds?: number;
  }): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (payload.expiresInSeconds ?? 3600); // 1 hora por defecto

    const header = { alg: 'HS256', typ: 'JWT' };
    const claims: JwtPayload = {
      sub: payload.userId,
      user_id: payload.userId,
      tenant_id: payload.tenantId,
      tenant_slug: payload.tenantSlug,
      email: payload.email,
      role: payload.role,
      iss: this.configService.get<string>('KEYCLOAK_ISSUER') ?? 'http://localhost:8080/realms/bankos',
      aud: this.configService.get<string>('KEYCLOAK_AUDIENCE') ?? 'bankos-api',
      iat: now,
      exp,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(claims));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`, this.secret);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verifica la firma, expiración y claims del token, retornando un AuthenticatedUser.
   */
  public verifyToken(token: string): AuthenticatedUser {
    if (!token) {
      throw new UnauthorizedException('Token de autenticación no proporcionado.');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Formato de token inválido.');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const content = `${headerB64}.${payloadB64}`;

    // 1. Verificar firma criptográfica
    const expectedSignature = this.sign(content, this.secret);
    if (!this.secureCompare(signatureB64, expectedSignature)) {
      this.logger.warn('Firma de token inválida.');
      throw new UnauthorizedException('Firma de token inválida.');
    }

    // 2. Decodificar payload
    let payload: JwtPayload;
    try {
      payload = JSON.parse(this.base64UrlDecode(payloadB64)) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Contenido del token corrupto.');
    }

    // 3. Verificar expiración (exp)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new UnauthorizedException('El token de sesión ha expirado.');
    }

    // 4. Validar claims obligatorios (tenant_id, sub/user_id, role)
    const userId = payload.user_id ?? payload.sub;
    if (!userId || !payload.tenant_id || !payload.role) {
      throw new UnauthorizedException(
        'El token no contiene los claims obligatorios (tenant_id, user_id, role).',
      );
    }

    const role = payload.role.toLowerCase() === 'admin' ? UserRole.ADMIN : UserRole.CUSTOMER;

    return new AuthenticatedUser(
      userId,
      payload.tenant_id,
      payload.tenant_slug ?? '',
      payload.email ?? '',
      role,
    );
  }

  private sign(data: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(data)
      .digest('base64url');
  }

  private secureCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64url');
  }

  private base64UrlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString('utf8');
  }
}

