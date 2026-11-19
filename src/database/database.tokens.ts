/**
 * Tokens de inyección de dependencias (DI) mediante Symbols.
 * Usar Symbols evita colisiones de nombres de cadenas ('string') en el contenedor de IoC de NestJS.
 */
export const DRIZZLE = Symbol('DRIZZLE_CONNECTION');
export const PG_POOL = Symbol('PG_POOL');
