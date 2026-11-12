import {
  BadRequestException,
  Inject,
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
import { TRANSACTION_REPOSITORY } from '../ports/transaction.repository.port';
import type { TransactionRepository } from '../ports/transaction.repository.port';
import { LEDGER_REPOSITORY } from '../../../ledger/application/ports/ledger.repository.port';
import type { LedgerRepository } from '../../../ledger/application/ports/ledger.repository.port';
import { OUTBOX_REPOSITORY } from '../../../webhooks/application/ports/outbox.repository.port';
import type { OutboxRepository } from '../../../webhooks/application/ports/outbox.repository.port';
import { OutboxEvent } from '../../../webhooks/domain/entities/outbox-event.entity';
import { Transaction } from '../../domain/entities/transaction.entity';
import { LedgerEntry } from '../../../ledger/domain/entities/ledger-entry.entity';
import { LedgerEntryType } from '../../domain/value-objects/transaction-types.enum';
import { FeeType } from '../../../tenants/domain/value-objects/fee-type.enum';
import { TransferResponseDto } from '../dto/transfer-response.dto';

export interface TransferInput {
  tenantSlug: string;
  sourceAccountNumber: string;
  destinationAccountNumber: string;
  targetAmount: string;
  idempotencyKey: string;
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

    // 3. Validar cuenta destino (CA-HU-09-03: Si es de otro tenant o inexistente, 404 seguro)
    const destinationAccount = await this.accountRepository.findByNumber(
      tenant.getId(),
      input.destinationAccountNumber.trim(),
    );
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
    const targetAmountNum = Number(input.targetAmount);
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

    // 8. Calcular comisión adicional en moneda de origen
    let feeNum = 0;
    if (feeType === FeeType.FIXED) {
      feeNum = feeValue;
    } else {
      feeNum = Number((sourceEquivalent * (feeValue / 100)).toFixed(2));
    }

    const feeAmountStr = feeNum.toFixed(2);
    const sourceEquivalentStr = sourceEquivalent.toFixed(2);
    const totalDebitNum = sourceEquivalent + feeNum;
    const totalDebitStr = totalDebitNum.toFixed(2);

    // 9. Validar límite máximo configurado
    if (settings) {
      const maxLimit = Number(settings.getMaxTransactionAmount());
      if (totalDebitNum > maxLimit) {
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
    destinationAccount.credit(Number(input.targetAmount).toFixed(2));

    // 12. Crear cabecera de Transacción
    const transaction = Transaction.createTransfer({
      tenantId: tenant.getId(),
      sourceAccountId: sourceAccount.getId(),
      destinationAccountId: destinationAccount.getId(),
      originalAmount: totalDebitStr,
      originalCurrency: sourceCurrency,
      convertedAmount: Number(input.targetAmount).toFixed(2),
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
      amount: Number(input.targetAmount).toFixed(2),
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
        targetAmount: Number(input.targetAmount).toFixed(2),
        totalDebited: totalDebitStr,
        feeAmount: feeAmountStr,
        exchangeRateApplied: rateAppliedStr,
        timestamp: transaction.getCreatedAt().toISOString(),
      },
    });

    // 15. Persistir de forma consistente
    await this.accountRepository.update(sourceAccount);
    await this.accountRepository.update(destinationAccount);
    await this.transactionRepository.save(transaction);
    await this.ledgerRepository.save(debitLedger);
    await this.ledgerRepository.save(creditLedger);
    if (this.outboxRepository) {
      await this.outboxRepository.save(outboxEvent);
    }

    // 15. Construir y devolver respuesta
    const response = new TransferResponseDto();
    response.transactionId = transaction.getId();
    response.sourceAccountNumber = sourceAccount.getAccountNumber();
    response.sourceCurrency = sourceCurrency;
    response.destinationAccountNumber = destinationAccount.getAccountNumber();
    response.destinationCurrency = destinationCurrency;
    response.targetAmount = Number(input.targetAmount).toFixed(2);
    response.sourceEquivalentAmount = sourceEquivalentStr;
    response.exchangeRateApplied = rateAppliedStr;
    response.feeAmount = feeAmountStr;
    response.totalDebited = totalDebitStr;
    response.sourceNewBalance = sourceAccount.getBalance();
    response.status = transaction.getStatus();
    response.createdAt = transaction.getCreatedAt().toISOString();

    return response;
  }
}
