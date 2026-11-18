/**
 * Tipo de comisión aplicada por el tenant a las transferencias salientes.
 *
 * - FIXED: Monto fijo aplicado en la moneda de origen de la transacción.
 * - PERCENTAGE: Porcentaje (entre 0% y 100%) calculado sobre el monto de origen.
 */
export enum FeeType {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

