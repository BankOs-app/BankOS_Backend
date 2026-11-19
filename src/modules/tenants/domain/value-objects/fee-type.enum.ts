/**
 * Tipo de comisión aplicada por el tenant a las transferencias salientes.
 *
 * - FIXED: Tarifa fija monetaria configurada por el tenant (ej. $2,500 COP).
 * - VARIABLE: Tarifa variable / porcentual sobre el monto transferido (ej. 1.50%).
 * - PERCENTAGE: Alias de compatibilidad para VARIABLE.
 */
export enum FeeType {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
  PERCENTAGE = 'PERCENTAGE',
}

