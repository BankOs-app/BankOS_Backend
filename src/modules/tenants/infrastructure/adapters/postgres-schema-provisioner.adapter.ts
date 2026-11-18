import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../../database/database.module';
import { SchemaProvisioner } from '../../application/ports/schema-provisioner.port';

/**
 * Adaptador de infraestructura para aprovisionar esquemas PostgreSQL independientes.
 *
 * Seguridad contra Inyección SQL:
 * - Se valida estrictamente el nombre del esquema contra un patrón seguro `^tenant_[a-z0-9_]{3,50}$`.
 * - Se utiliza el entrecomillado de identificadores de PostgreSQL (`"${safeName}"`).
 */
@Injectable()
export class PostgresSchemaProvisionerAdapter implements SchemaProvisioner {
  private readonly logger = new Logger(PostgresSchemaProvisionerAdapter.name);
  private static readonly SAFE_SCHEMA_REGEX = /^tenant_[a-z0-9_]{3,50}$/;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async provisionSchema(schemaName: string): Promise<void> {
    // 1. Validación estricta contra inyección SQL (Criterio CA-HU-01-03)
    if (!PostgresSchemaProvisionerAdapter.SAFE_SCHEMA_REGEX.test(schemaName)) {
      throw new Error(
        `Nombre de esquema no permitido o potencialmente inseguro: '${schemaName}'`,
      );
    }

    this.logger.log(`Aprovisionando nuevo esquema aislado: ${schemaName}`);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Crear el esquema aislado
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      // 3. Confirmar transacción
      await client.query('COMMIT');
      this.logger.log(`Esquema '${schemaName}' aprovisionado exitosamente.`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Error durante el aprovisionamiento del esquema '${schemaName}'`,
        error,
      );
      throw error;
    } finally {
      client.release();
    }
  }
}

