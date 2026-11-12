/**
 * Enumeración que define el ciclo de vida de un Tenant en la plataforma.
 * 
 * Regla de negocio:
 * - PROVISIONING: El tenant fue registrado pero sus recursos (esquema SQL, tablas) se están creando.
 * - ACTIVE: El aprovisionamiento fue exitoso y el banco/cooperativa puede operar.
 * - FAILED: Ocurrió un error creando el esquema o migraciones; no puede operar.
 */
export enum TenantStatus {
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  FAILED = 'FAILED',
}

