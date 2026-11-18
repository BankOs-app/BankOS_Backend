import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

/**
 * Tokens de inyección de dependencias (DI) mediante Symbols.
 * Usar Symbols evita colisiones de nombres de cadenas ('string') en el contenedor de IoC de NestJS.
 */
export const DRIZZLE = Symbol('DRIZZLE_CONNECTION');
export const PG_POOL = Symbol('PG_POOL');

/**
 * Tipo exportado de la base de datos Drizzle para su uso en repositorios y adaptadores.
 */
export type DrizzleDb = NodePgDatabase;

/**
 * DatabaseModule (Módulo de Base de Datos).
 *
 * Se marca como `@Global()` para que la conexión a PostgreSQL y la instancia de Drizzle ORM
 * estén disponibles en cualquier módulo de la aplicación sin necesidad de importar `DatabaseModule`
 * repetidamente en cada uno.
 *
 * Arquitectura:
 * - `PG_POOL`: Administra el pool de conexiones nativas hacia PostgreSQL mediante la librería `pg`.
 *   El pooling reutiliza sockets TCP existentes, reduciendo la latencia de cada query.
 * - `DRIZZLE`: Inicializa Drizzle ORM envolviendo el pool de PostgreSQL. Drizzle ofrece
 *   consultas tipadas ('type-safe') sin sobrecarga de runtime ni generación opaca de SQL.
 */
@Global()
@Module({
  providers: [
    // Proveedor del pool de conexiones de PostgreSQL
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
        // Lee la URL de conexión desde .env o recurre al valor por defecto para desarrollo local
        const connectionString = configService.get<string>(
          'DATABASE_URL',
          'postgres://postgres:postgres@localhost:5432/bankos_db',
        );
        return new Pool({ connectionString });
      },
    },
    // Proveedor de la instancia Drizzle ORM conectada al pool
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): DrizzleDb => {
        return drizzle(pool);
      },
    },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Cierre elegante ('graceful shutdown') cuando NestJS recibe señales SIGINT o SIGTERM.
   */
  async onApplicationShutdown() {
    // Si se requiere cerrar recursos adicionales o pools al apagar la aplicación
  }
}


