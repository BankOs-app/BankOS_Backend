/**
 * Roles del sistema BankOS según especificación:
 *
 * - ADMINISTRADOR: Crear cuentas, modificar configuración, auditar logs y consultar operaciones del banco.
 * - CLIENTE: Consultar y operar únicamente sobre las cuentas de las cuales es titular.
 */
export enum UserRole {
  ADMIN = 'admin',
  CUSTOMER = 'customer',
}

