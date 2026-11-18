import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from './database.tokens';
import { TenantSchemaResolver } from './tenant-schema-resolver.service';

export { DRIZZLE, PG_POOL } from './database.tokens';

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
 */
@Global()
@Module({
  providers: [
    TenantSchemaResolver,
    // Proveedor del pool de conexiones de PostgreSQL
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Pool => {
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
  exports: [DRIZZLE, PG_POOL, TenantSchemaResolver],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly configService: ConfigService) { }

  async onApplicationShutdown() {
    // Si se requiere cerrar recursos adicionales o pools al apagar la aplicación
  }
}



