/**
 * Tipos de operaciones financieras soportadas en BankOS.
 */
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
}

/**
 * Estado final de la transacción financiera.
 */
export enum TransactionStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

/**
 * Tipo de asiento contable en el Ledger (Partida doble).
 */
export enum LedgerEntryType {
  CREDIT = 'CREDIT', // Abono / Entrada de dinero
  DEBIT = 'DEBIT',   // Débito / Salida de dinero
}

