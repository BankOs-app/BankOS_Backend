/**
 * Estados del ciclo de vida de una Cuenta Bancaria.
 *
 * - ACTIVE: Cuenta operativa que permite depósitos, retiros y transferencias.
 * - BLOCKED: Cuenta congelada temporalmente por motivos de seguridad o riesgo.
 * - INACTIVE: Cuenta cerrada mediante borrado lógico (Soft Delete); conserva historial pero no permite operaciones.
 */
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  INACTIVE = 'INACTIVE',
}

