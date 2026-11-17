import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro Global de Excepciones para BankOS (Sección 1.G de Proyecto.txt).
 *
 * Estandariza todas las respuestas de error de la API con una estructura bancaria uniforme:
 * - `success`: Siempre false en errores.
 * - `statusCode`: Código de estado HTTP (400, 401, 403, 404, 409, 429, 500).
 * - `internalCode`: Código semántico interno de negocio (ej. BANKOS_INSUFFICIENT_FUNDS, BANKOS_RATE_LIMIT_EXCEEDED).
 * - `description`: Descripción comprensible del error en español.
 * - `message`: Alias de description para compatibilidad con librerías estándar.
 * - `correlationId`: Identificador único 'X-Correlation-ID' para trazabilidad distribuida.
 * - `timestamp`: Fecha y hora ISO del incidente.
 * - `path`: Ruta HTTP donde ocurrió la anomalía.
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let rawMessage: string | string[] = 'Ha ocurrido un error interno en el servidor.';
    let internalCode = 'BANKOS_INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        rawMessage = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        rawMessage = resObj.message ?? resObj.error ?? exception.message;
        if (resObj.internalCode) {
          internalCode = resObj.internalCode;
        }
      }
    } else if (exception instanceof Error) {
      rawMessage = exception.message;
    }

    const description = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : String(rawMessage);

    // Mapeo semántico de códigos internos según el estado o el contenido del mensaje
    if (internalCode === 'BANKOS_INTERNAL_ERROR') {
      internalCode = this.resolveInternalCode(statusCode, description);
    }

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request as any).correlationId;

    if (statusCode >= 500) {
      this.logger.error(
        `[${internalCode}] Error no controlado en ${request.method} ${request.url}: ${description}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${internalCode}] ${statusCode} en ${request.method} ${request.url}: ${description}`,
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      internalCode,
      description,
      message: description,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId: correlationId || undefined,
    });
  }

  private resolveInternalCode(status: number, message: string): string {
    const lower = message.toLowerCase();

    if (lower.includes('insuficiente')) {
      return 'BANKOS_INSUFFICIENT_FUNDS';
    }
    if (lower.includes('idempotency')) {
      return 'BANKOS_IDEMPOTENCY_ERROR';
    }
    if (lower.includes('límite') || lower.includes('limite') || lower.includes('excede')) {
      return 'BANKOS_TRANSACTION_LIMIT_EXCEEDED';
    }
    if (lower.includes('tasa') || lower.includes('cambio') || lower.includes('divisa')) {
      return 'BANKOS_EXCHANGE_RATE_ERROR';
    }
    if (lower.includes('inactiva') || lower.includes('bloqueada')) {
      return 'BANKOS_ACCOUNT_NOT_ACTIVE';
    }

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BANKOS_BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'BANKOS_UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'BANKOS_FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'BANKOS_NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'BANKOS_CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'BANKOS_RATE_LIMIT_EXCEEDED';
      default:
        return 'BANKOS_INTERNAL_ERROR';
    }
  }
}
