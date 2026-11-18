import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

/**
 * Guard personalizado para limitar la tasa de peticiones (Rate Limiting) - Sección 1.B de Proyecto.txt.
 *
 * Reglas de negocio:
 * 1. Para peticiones autenticadas (transacciones financieras, consultas de cuentas):
 *    El límite se aplica por cuenta de usuario (`user:<tenantId>:<userId>`), evitando que un atacante
 *    sature los servicios usando proxies o rotando IPs para un mismo usuario.
 * 2. Para peticiones no autenticadas (autenticación / token):
 *    El límite se aplica por dirección IP (`ip:<clientIp>`) para mitigar ataques de fuerza bruta.
 */
@Injectable()
export class BankThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Si el usuario ya está autenticado, rastreamos por usuario
    if (req.user?.userId) {
      return `user:${req.user.tenantId ?? 'default'}:${req.user.userId}`;
    }

    // Si no está autenticado, rastreamos por dirección IP
    const forwarded = req.headers?.['x-forwarded-for'];
    const clientIp =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ||
      req.ip ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    return `ip:${clientIp}`;
  }

  protected async getErrorMessage(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    return 'Límite de peticiones alcanzado. Por favor, espere un momento antes de volver a intentar.';
  }
}

