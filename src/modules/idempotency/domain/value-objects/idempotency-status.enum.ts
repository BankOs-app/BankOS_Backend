/**
 * Estados del registro de idempotencia.
 *
 * - PROCESSING: La operación se encuentra en ejecución concurrente.
 * - SUCCEEDED: La operación finalizó con éxito y su respuesta original está almacenada.
 * - FAILED: La operación falló (rollback financiero).
 */
export enum IdempotencyStatus {
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

