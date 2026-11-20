import {
  BadRequestException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { TENANT_SETTINGS_REPOSITORY } from '../../../tenants/application/ports/tenant-settings.repository.port';
import type { TenantSettingsRepository } from '../../../tenants/application/ports/tenant-settings.repository.port';
import { EXCHANGE_RATE_REPOSITORY } from '../../../tenants/application/ports/exchange-rate.repository.port';
import type { ExchangeRateRepository } from '../../../tenants/application/ports/exchange-rate.repository.port';
import { ACCOUNT_REPOSITORY } from '../../../accounts/application/ports/account.repository.port';
import type { AccountRepository } from '../../../accounts/application/ports/account.repository.port';
import { Account } from '../../../accounts/domain/entities/account.entity';
import { TRANSACTION_REPOSITORY } from '../ports/transaction.repository.port';
import type { TransactionRepository } from '../ports/transaction.repository.port';
import { LEDGER_REPOSITORY } from '../../../ledger/application/ports/ledger.repository.port';
import type { LedgerRepository } from '../../../ledger/application/ports/ledger.repository.port';
import { OUTBOX_REPOSITORY } from '../../../webhooks/application/ports/outbox.repository.port';
import type { OutboxRepository } from '../../../webhooks/application/ports/outbox.repository.port';
import { OutboxDispatcherService } from '../../../webhooks/application/services/outbox-dispatcher.service';
import { OutboxEvent } from '../../../webhooks/domain/entities/outbox-event.entity';
import { Transaction } from '../../domain/entities/transaction.entity';
import { LedgerEntry } from '../../../ledger/domain/entities/ledger-entry.entity';
import { LedgerEntryType } from '../../domain/value-objects/transaction-types.enum';
import { FeeType } from '../../../tenants/domain/value-objects/fee-type.enum';
import { TransferResponseDto } from '../dto/transfer-response.dto';
import { RecordAuditLogUseCase } from '../../../audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../audit/domain/value-objects/audit-action.enum';
import { PG_POOL } from '../../../../database/database.module';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import type { Pool } from 'pg';

export interface TransferInput {
  tenantSlug: string;
  sourceAccountNumber: string;
  destinationAccountNumber: string;
  targetAmount: string;
  sourceAmount?: string;
  idempotencyKey: string;
  userId?: string;
}

/**
 * Caso de Uso: Ejecutar Transferencia Interna / Multimoneda (HU-09)
 *
 * Criterios de Aceptación:
 * - CA-HU-09-01: Transferencia misma moneda con comisión y débito total.
 * - CA-HU-09-02: Transferencia multimoneda con conversión por tasa estática y comisión.
 * - CA-HU-09-03: Rechazo de cuentas de otro tenant o no encontradas sin fugar datos.
 * - CA-HU-09-04: Rechazo si el saldo es insuficiente para monto convertido + comisión.
 * - CA-HU-09-05: Débito en origen, crédito en destino y registro en Ledger atómico.
 * - CA-HU-09-06: Persistencia atómica de todos los componentes.
 */
@Injectable()
export class TransferUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(TENANT_SETTINGS_REPOSITORY)
    private readonly settingsRepository: TenantSettingsRepository,
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: ExchangeRateRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepository: LedgerRepository,
    @Optional()
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepository?: OutboxRepository,
    @Optional()
    private readonly outboxDispatcherService?: OutboxDispatcherService,
    @Optional()
    private readonly recordAuditLogUseCase?: RecordAuditLogUseCase,
    @Optional()
    @Inject(PG_POOL)
    private readonly pool?: Pool,
    @Optional()
    private readonly schemaResolver?: TenantSchemaResolver,
  ) {}

  async execute(input: TransferInput): Promise<TransferResponseDto> {
    // 1. Validar tenant
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    // 2. Validar cuenta origen
    const sourceAccount = await this.accountRepository.findByNumber(
      tenant.getId(),
      input.sourceAccountNumber.trim(),
    );
    if (!sourceAccount) {
      throw new NotFoundException(
        `Cuenta origen '${input.sourceAccountNumber}' no encontrada en esta institución.`,
      );
    }

    if (input.userId && sourceAccount.getCustomerId() !== input.userId) {
      throw new ForbiddenException(
        'No tiene autorización para transferir fondos desde una cuenta que no le pertenece.',
      );
    }

    // 3. Resolver la cuenta destino globalmente por su número único.
    const destinationMatches = this.accountRepository.findByNumberAcrossTenants
      ? await this.accountRepository.findByNumberAcrossTenants(
          input.destinationAccountNumber.trim(),
        )
      : [
          await this.accountRepository.findByNumber(
            tenant.getId(),
            input.destinationAccountNumber.trim(),
          ),
        ].filter((account) => account !== null);
    if (destinationMatches.length > 1) {
      throw new BadRequestException(
        'El número de cuenta destino está duplicado y no identifica una única cuenta.',
      );
    }
    const destinationAccount = destinationMatches[0] ?? null;
    if (!destinationAccount) {
      throw new NotFoundException(
        `Cuenta destino '${input.destinationAccountNumber}' no encontrada en esta institución.`,
      );
    }

    // 4. Validar estado de ambas cuentas
    if (!sourceAccount.canTransact()) {
      throw new BadRequestException(
        `La cuenta de origen se encuentra en estado '${sourceAccount.getStatus()}'.`,
      );
    }
    if (!destinationAccount.canTransact()) {
      throw new BadRequestException(
        `La cuenta de destino se encuentra en estado '${destinationAccount.getStatus()}'.`,
      );
    }

    // 5. Validar monto positivo
    let targetAmountNum = Number(input.targetAmount);
    if (isNaN(targetAmountNum) || targetAmountNum <= 0) {
      throw new BadRequestException(
        'El monto que recibirá el destino debe ser estrictamente positivo y mayor a 0.',
      );
    }

    // 6. Consultar configuración de reglas financieras del tenant
    const settings = await this.settingsRepository.findByTenantId(tenant.getId());
    const feeType = settings ? settings.getFeeType() : FeeType.FIXED;
    const feeValue = settings ? Number(settings.getFeeValue()) : 0;

    // 7. Calcular tasa de cambio y monto equivalente en origen
    const sourceCurrency = sourceAccount.getCurrency();
    const destinationCurrency = destinationAccount.getCurrency();

    let sourceEquivalent: number;
    let rateAppliedStr: string;

    if (sourceCurrency === destinationCurrency) {
      sourceEquivalent = targetAmountNum;
      rateAppliedStr = '1.000000';
    } else {
      // Buscar tasa directa (1 source = rate destination)
      const directRate = await this.exchangeRateRepository.findRate(
        tenant.getId(),
        sourceCurrency,
        destinationCurrency,
      );

      if (directRate) {
        const rateNum = Number(directRate.getRate());
        sourceEquivalent = Number((targetAmountNum / rateNum).toFixed(2));
        rateAppliedStr = directRate.getRate();
      } else {
        // Buscar tasa inversa (1 destination = inverseRate source)
        const inverseRate = await this.exchangeRateRepository.findRate(
          tenant.getId(),
          destinationCurrency,
          sourceCurrency,
        );

        if (inverseRate) {
          const rateNum = Number(inverseRate.getRate());
          sourceEquivalent = Number((targetAmountNum * rateNum).toFixed(2));
          rateAppliedStr = inverseRate.getRate();
        } else {
          throw new BadRequestException(
            `No existe una tasa de cambio configurada para el par '${sourceCurrency}' -> '${destinationCurrency}'.`,
          );
        }
      }
    }

    if (input.sourceAmount !== undefined) {
      const requestedSourceAmount = Number(input.sourceAmount);
      if (!Number.isFinite(requestedSourceAmount) || requestedSourceAmount <= 0) {
        throw new BadRequestException('El monto de origen debe ser estrictamente positivo.');
      }
      sourceEquivalent = requestedSourceAmount;
      if (sourceCurrency === destinationCurrency) {
        targetAmountNum = requestedSourceAmount;
      } else {
        const directRate = await this.exchangeRateRepository.findRate(
          tenant.getId(), sourceCurrency, destinationCurrency,
        );
        if (directRate) {
          targetAmountNum = Number((requestedSourceAmount * Number(directRate.getRate())).toFixed(2));
          rateAppliedStr = directRate.getRate();
        } else {
          const inverseRate = await this.exchangeRateRepository.findRate(
            tenant.getId(), destinationCurrency, sourceCurrency,
          );
          if (!inverseRate) throw new BadRequestException(`No existe una tasa de cambio configurada para el par '${sourceCurrency}' -> '${destinationCurrency}'.`);
          targetAmountNum = Number((requestedSourceAmount / Number(inverseRate.getRate())).toFixed(2));
          rateAppliedStr = inverseRate.getRate();
        }
      }
    }

    // 8. Calcular comisión adicional en moneda de origen
    let feeNum = 0;
    const isVariableFee =
      feeType === FeeType.VARIABLE || feeType === FeeType.PERCENTAGE;

    if (isVariableFee) {
      feeNum = Number((sourceEquivalent * (feeValue / 100)).toFixed(2));
    } else {
      // Tarifa fija: feeValue está expresado en la moneda principal del tenant
      const primaryCurrency = settings ? settings.getPrimaryCurrency() : sourceCurrency;
      if (sourceCurrency === primaryCurrency) {
        feeNum = feeValue;
      } else {
        // Convertir feeValue (en primaryCurrency) a la moneda de la cuenta origen
        const directRate = await this.exchangeRateRepository.findRate(
          tenant.getId(),
          primaryCurrency,
          sourceCurrency,
        );
        if (directRate) {
          feeNum = Number((feeValue * Number(directRate.getRate())).toFixed(2));
        } else {
          const inverseRate = await this.exchangeRateRepository.findRate(
            tenant.getId(),
            sourceCurrency,
            primaryCurrency,
          );
          if (inverseRate) {
            feeNum = Number((feeValue / Number(inverseRate.getRate())).toFixed(2));
          } else {
            feeNum = feeValue;
          }
        }
      }
    }

    const feeAmountStr = feeNum.toFixed(2);
    const sourceEquivalentStr = sourceEquivalent.toFixed(2);
    const totalDebitNum = sourceEquivalent + feeNum;
    const totalDebitStr = totalDebitNum.toFixed(2);

    // 9. Validar límite máximo configurado
    if (settings) {
      const maxLimit = Number(settings.getMaxTransactionAmount());
      const primaryCurrency = settings.getPrimaryCurrency();
      let totalDebitInPrimaryCurrency = totalDebitNum;

      if (sourceCurrency !== primaryCurrency) {
        const directRate = await this.exchangeRateRepository.findRate(
          tenant.getId(),
          sourceCurrency,
          primaryCurrency,
        );
        if (directRate) {
          totalDebitInPrimaryCurrency = totalDebitNum * Number(directRate.getRate());
        } else {
          const inverseRate = await this.exchangeRateRepository.findRate(
            tenant.getId(),
            primaryCurrency,
            sourceCurrency,
          );
          if (inverseRate) {
            totalDebitInPrimaryCurrency = totalDebitNum / Number(inverseRate.getRate());
          }
        }
      }

      if (totalDebitInPrimaryCurrency > maxLimit) {
        throw new BadRequestException(
          `El total a debitar (${totalDebitStr} ${sourceCurrency}) excede el límite máximo permitido por transacción (${settings.getMaxTransactionAmount()} ${settings.getPrimaryCurrency()}).`,
        );
      }
    }

    // 10. Validar saldo suficiente (CA-HU-09-04)
    const currentBalance = Number(sourceAccount.getBalance());
    if (currentBalance < totalDebitNum) {
      throw new BadRequestException(
        `Saldo insuficiente para transferir el monto requerido con comisiones (${totalDebitStr} ${sourceCurrency}). Saldo disponible: ${sourceAccount.getBalance()} ${sourceCurrency}.`,
      );
    }

    // 11. Ejecutar movimientos de balance
    sourceAccount.debit(totalDebitStr);
    destinationAccount.credit(targetAmountNum.toFixed(2));

    // 12. Crear cabecera de Transacción
    const transaction = Transaction.createTransfer({
      tenantId: tenant.getId(),
      sourceAccountId: sourceAccount.getId(),
      destinationAccountId: destinationAccount.getId(),
      sourceTenantId: sourceAccount.getTenantId(),
      destinationTenantId: destinationAccount.getTenantId(),
      originalAmount: totalDebitStr,
      originalCurrency: sourceCurrency,
      convertedAmount: targetAmountNum.toFixed(2),
      destinationCurrency: destinationCurrency,
      exchangeRateApplied: rateAppliedStr,
      feeAmount: feeAmountStr,
      idempotencyKey: input.idempotencyKey,
    });

    // 13. Crear asientos contables en Ledger (CA-HU-09-05)
    const debitLedger = LedgerEntry.create({
      tenantId: tenant.getId(),
      transactionId: transaction.getId(),
      accountId: sourceAccount.getId(),
      type: LedgerEntryType.DEBIT,
      amount: totalDebitStr,
      currency: sourceCurrency,
    });

    const creditLedger = LedgerEntry.create({
      tenantId: tenant.getId(),
      transactionId: transaction.getId(),
      accountId: destinationAccount.getId(),
      type: LedgerEntryType.CREDIT,
      amount: targetAmountNum.toFixed(2),
      currency: destinationCurrency,
    });

    // 14. Crear evento Outbox para entrega asíncrona de Webhook (CA-HU-15-01)
    const outboxEvent = OutboxEvent.create({
      tenantId: tenant.getId(),
      eventType: 'transfer.completed',
      payload: {
        transactionId: transaction.getId(),
        sourceAccountNumber: sourceAccount.getAccountNumber(),
        sourceCurrency: sourceCurrency,
        destinationAccountNumber: destinationAccount.getAccountNumber(),
        destinationCurrency: destinationCurrency,
        targetAmount: targetAmountNum.toFixed(2),
        totalDebited: totalDebitStr,
        feeAmount: feeAmountStr,
        exchangeRateApplied: rateAppliedStr,
        timestamp: transaction.getCreatedAt().toISOString(),
      },
    });

    // 15. Persistir de forma consistente
    let sourceNewBalance = sourceAccount.getBalance();
    if (sourceAccount.getTenantId() !== destinationAccount.getTenantId()) {
      sourceNewBalance = await this.persistCrossTenantTransfer({
        sourceAccount,
        destinationAccount,
        transaction,
        debitLedger,
        creditLedger,
        outboxEvent,
        totalDebitStr,
        destinationAmount: targetAmountNum.toFixed(2),
      });
    } else {
      await this.accountRepository.update(sourceAccount);
      await this.accountRepository.update(destinationAccount);
      await this.transactionRepository.save(transaction);
      await this.ledgerRepository.save(debitLedger);
      await this.ledgerRepository.save(creditLedger);
      if (this.outboxRepository) {
        await this.outboxRepository.save(outboxEvent);
      }
    }
    if (this.outboxRepository) {
      if (this.outboxDispatcherService) {
        setImmediate(() => {
          this.outboxDispatcherService!.processSingleEvent(outboxEvent).catch(() => {});
        });
      }
    }

    // 15. Construir y devolver respuesta
    const response = new TransferResponseDto();
    response.transactionId = transaction.getId();
    response.sourceAccountNumber = sourceAccount.getAccountNumber();
    response.sourceCurrency = sourceCurrency;
    response.destinationAccountNumber = destinationAccount.getAccountNumber();
    response.destinationCurrency = destinationCurrency;
    response.targetAmount = targetAmountNum.toFixed(2);
    response.sourceEquivalentAmount = sourceEquivalentStr;
    response.exchangeRateApplied = rateAppliedStr;
    response.feeAmount = feeAmountStr;
    response.totalDebited = totalDebitStr;
    response.sourceNewBalance = sourceNewBalance;
    response.status = transaction.getStatus();
    response.createdAt = transaction.getCreatedAt().toISOString();

    return response;
  }

  private async persistCrossTenantTransfer(input: {
    sourceAccount: Account;
    destinationAccount: Account;
    transaction: Transaction;
    debitLedger: LedgerEntry;
    creditLedger: LedgerEntry;
    outboxEvent: OutboxEvent;
    totalDebitStr: string;
    destinationAmount: string;
  }): Promise<string> {
    if (!this.pool || !this.schemaResolver) {
      throw new InternalServerErrorException(
        'La persistencia interbancaria no está configurada.',
      );
    }

    const sourceSchema = this.quoteSchema(
      (await this.schemaResolver.resolve(input.sourceAccount.getTenantId())).schemaName,
    );
    const destinationSchema = this.quoteSchema(
      (await this.schemaResolver.resolve(input.destinationAccount.getTenantId())).schemaName,
    );
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const debit = await client.query(
        `UPDATE ${sourceSchema}.accounts
         SET balance = balance - $1::numeric, updated_at = NOW()
         WHERE id = $2 AND status = 'ACTIVE' AND balance >= $1::numeric
         RETURNING balance`,
        [input.totalDebitStr, input.sourceAccount.getId()],
      );
      if (debit.rowCount !== 1) {
        throw new BadRequestException(
          'La cuenta de origen cambió de estado o ya no tiene saldo suficiente.',
        );
      }

      const credit = await client.query(
        `UPDATE ${destinationSchema}.accounts
         SET balance = balance + $1::numeric, updated_at = NOW()
         WHERE id = $2 AND status = 'ACTIVE'
         RETURNING id`,
        [input.destinationAmount, input.destinationAccount.getId()],
      );
      if (credit.rowCount !== 1) {
        throw new BadRequestException(
          'La cuenta destino dejó de estar activa durante la operación.',
        );
      }

      const transactionValues = [
        input.transaction.getId(),
        input.transaction.getType(),
        input.sourceAccount.getId(),
        input.destinationAccount.getId(),
        input.sourceAccount.getTenantId(),
        input.destinationAccount.getTenantId(),
        input.transaction.getOriginalAmount(),
        input.transaction.getOriginalCurrency(),
        input.transaction.getConvertedAmount() ?? null,
        input.transaction.getDestinationCurrency() ?? null,
        input.transaction.getExchangeRateApplied() ?? null,
        input.transaction.getFeeAmount() ?? null,
        input.transaction.getStatus(),
        input.transaction.getIdempotencyKey(),
        input.transaction.getCreatedAt(),
      ];
      const transactionInsert = `INSERT INTO %SCHEMA%.transactions
        (id, type, source_account_id, destination_account_id, source_tenant_id,
         destination_tenant_id, original_amount, original_currency, converted_amount,
         destination_currency, exchange_rate_applied, fee_amount, status,
         idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`;
      await client.query(
        transactionInsert.replace('%SCHEMA%', sourceSchema),
        transactionValues,
      );

      const destinationMirrorValues = [...transactionValues];
      destinationMirrorValues[2] = null;
      await client.query(
        transactionInsert.replace('%SCHEMA%', destinationSchema),
        destinationMirrorValues,
      );

      await client.query(
        `INSERT INTO ${sourceSchema}.ledger_entries
          (id, transaction_id, account_id, type, amount, currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.debitLedger.getId(),
          input.debitLedger.getTransactionId(),
          input.debitLedger.getAccountId(),
          input.debitLedger.getType(),
          input.debitLedger.getAmount(),
          input.debitLedger.getCurrency(),
          input.debitLedger.getCreatedAt(),
        ],
      );
      await client.query(
        `INSERT INTO ${destinationSchema}.ledger_entries
          (id, transaction_id, account_id, type, amount, currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.creditLedger.getId(),
          input.creditLedger.getTransactionId(),
          input.creditLedger.getAccountId(),
          input.creditLedger.getType(),
          input.creditLedger.getAmount(),
          input.creditLedger.getCurrency(),
          input.creditLedger.getCreatedAt(),
        ],
      );

      if (this.outboxRepository) {
        await client.query(
          `INSERT INTO ${sourceSchema}.outbox_events
            (id, event_type, payload, status, attempts, max_attempts,
             next_retry_at, last_error, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, NOW())`,
          [
            input.outboxEvent.getId(),
            input.outboxEvent.getEventType(),
            JSON.stringify(input.outboxEvent.getPayload()),
            input.outboxEvent.getStatus(),
            input.outboxEvent.getAttempts(),
            input.outboxEvent.getMaxAttempts(),
            input.outboxEvent.getNextRetryAt() ?? null,
            input.outboxEvent.getLastError() ?? null,
            input.outboxEvent.getCreatedAt(),
          ],
        );
      }

      await client.query('COMMIT');
      return String(debit.rows[0].balance);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private quoteSchema(schemaName: string): string {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) {
      throw new InternalServerErrorException('Nombre de esquema bancario inválido.');
    }
    return `"${schemaName}"`;
  }
}
