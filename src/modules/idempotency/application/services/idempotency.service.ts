import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { IDEMPOTENCY_REPOSITORY } from '../ports/idempotency.repository.port';
import type { IdempotencyRepository } from '../ports/idempotency.repository.port';
import { IdempotencyRecord } from '../../domain/entities/idempotency-record.entity';

export interface LockResult {
  isCached: boolean;
  responseStatus?: number;
  responseBody?: unknown;
  record?: IdempotencyRecord;
}

/**
 * Servicio de Idempotencia para Operaciones Mutables (HU-10).
 *
 * Aplica:
 * - Detección de concurrencia (409 Conflict si está en PROCESSING).
 * - Detección de payload alterado (409 Conflict si hash difiere).
 * - Devolución de respuesta original (si ya está SUCCEEDED).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @Inject(IDEMPOTENCY_REPOSITORY)
    private readonly repository: IdempotencyRepository,
  ) {}

  /**
   * Calcula la huella digital SHA-256 canónica de los parámetros relevantes del request.
   */
  public computeHash(payload: unknown, path: string, method: string): string {
    const canonical = JSON.stringify({
      method: method.toUpperCase(),
      path: path.toLowerCase(),
      body: payload ?? {},
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Intenta adquirir el bloqueo para procesar la clave de idempotencia.
   */
  public async acquireLock(params: {
    tenantId: string;
    userId: string;
    key: string;
    requestHash: string;
  }): Promise<LockResult> {
    const existing = await this.repository.findByKey(
      params.tenantId,
      params.userId,
      params.key,
    );

    if (existing && !existing.isExpired()) {
      // 1. Criterio CA-HU-10-04: Si la misma clave se envía con un payload distinto -> 409 Conflict
      if (!existing.matchesHash(params.requestHash)) {
        this.logger.warn(
          `Idempotency-Key '${params.key}' reutilizada con un payload diferente.`,
        );
        throw new ConflictException(
          'La Idempotency-Key especificada ya fue utilizada previamente con parámetros de solicitud diferentes.',
        );
      }

      // 2. Criterio CA-HU-10-05: Si está en ejecución concurrente -> 409 Conflict
      if (existing.isProcessing()) {
        this.logger.warn(
          `Operación concurrente detectada en curso para la clave '${params.key}'.`,
        );
        throw new ConflictException(
          'La transacción financiera se encuentra actualmente en curso. Espere el resultado antes de reintentar.',
        );
      }

      // 3. Criterio CA-HU-10-03: Si ya finalizó con éxito -> Devolver respuesta original cacheada
      if (existing.isSucceeded()) {
        this.logger.log(
          `Reintento detectado para la clave '${params.key}'. Devolviendo respuesta original guardada.`,
        );
        const parsedBody = existing.getResponseBody()
          ? JSON.parse(existing.getResponseBody()!)
          : undefined;

        return {
          isCached: true,
          responseStatus: existing.getResponseStatus(),
          responseBody: parsedBody,
          record: existing,
        };
      }
    }

    // 4. Si no existía o había expirado, se crea un nuevo bloqueo en estado PROCESSING
    const newRecord = IdempotencyRecord.create({
      tenantId: params.tenantId,
      userId: params.userId,
      key: params.key,
      requestHash: params.requestHash,
    });

    await this.repository.save(newRecord);

    return {
      isCached: false,
      record: newRecord,
    };
  }

  /**
   * Guarda el resultado exitoso junto con la respuesta HTTP para reintentos posteriores.
   */
  public async markSucceeded(
    record: IdempotencyRecord,
    statusCode: number,
    responseBody: unknown,
  ): Promise<void> {
    const bodyStr = responseBody !== undefined ? JSON.stringify(responseBody) : '{}';
    record.markSucceeded(statusCode, bodyStr);
    await this.repository.update(record);
  }

  /**
   * Marca el registro como fallido en caso de error para permitir reintentar o auditar.
   */
  public async markFailed(record: IdempotencyRecord): Promise<void> {
    record.markFailed();
    await this.repository.update(record);
  }
}

