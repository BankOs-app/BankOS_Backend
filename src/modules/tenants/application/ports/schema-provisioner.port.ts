export const SCHEMA_PROVISIONER = Symbol('SCHEMA_PROVISIONER');

/**
 * Puerto (Contrato) para el aprovisionamiento de esquemas PostgreSQL de tenants.
 *
 * Cada tenant en BankOS opera en su propio esquema de base de datos (`tenant_<slug>`).
 * Este puerto define la capacidad de crear y preparar dicho esquema de forma segura.
 */
export interface SchemaProvisioner {
  /**
   * Crea el esquema aislado para el tenant y ejecuta las migraciones iniciales necesarias.
   *
   * @param schemaName Nombre seguro y validado del esquema (ej. "tenant_banco_bogota")
   */
  provisionSchema(schemaName: string): Promise<void>;
}

