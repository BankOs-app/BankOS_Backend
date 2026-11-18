import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { TENANT_SETTINGS_REPOSITORY } from '../../../tenants/application/ports/tenant-settings.repository.port';
import type { TenantSettingsRepository } from '../../../tenants/application/ports/tenant-settings.repository.port';
import { ACCOUNT_REPOSITORY } from '../../../accounts/application/ports/account.repository.port';
import type { AccountRepository } from '../../../accounts/application/ports/account.repository.port';
import { TRANSACTION_REPOSITORY } from '../ports/transaction.repository.port';
import type { TransactionRepository } from '../ports/transaction.repository.port';
import { LEDGER_REPOSITORY } from '../../../ledger/application/ports/ledger.repository.port';
import type { LedgerRepository } from '../../../ledger/application/ports/ledger.repository.port';
import { Transaction } from '../../domain/entities/transaction.entity';
import { LedgerEntry } from '../../../ledger/domain/entities/ledger-entry.entity';
import { LedgerEntryType } from '../../domain/value-objects/transaction-types.enum';
import { WithdrawResponseDto } from '../dto/withdraw-response.dto';

export interface WithdrawInput {
  tenantSlug: string;
  accountNumber: string;
  amount: string;
  idempotencyKey: string;
}

/**
 * Caso de Uso: Realizar Retiro de Cuenta Bancaria Activa (HU-08)
 *
 * Flujo:
 * 1. Validar tenant por slug.
 * 2. Validar que la cuenta pertenezca al tenant y exista.
 * 3. Validar que la cuenta esté activa (CA-HU-08-01, CA-HU-05-04).
 * 4. Validar que el monto sea un número estrictamente positivo (> 0).
 * 5. Validar que no supere el límite máximo por transacción configurado en el tenant.
 * 6. Validar que el saldo sea suficiente (CA-HU-08-02, CA-HU-08-03).
 * 7. Debitar saldo de la cuenta atómicamente.
 * 8. Registrar cabecera en Transaction y asiento de débito en Ledger.
 */
@Injectable()
export class WithdrawUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(TENANT_SETTINGS_REPOSITORY)
    private readonly settingsRepository: TenantSettingsRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepository: LedgerRepository,
  ) {}

  async execute(input: WithdrawInput): Promise<WithdrawResponseDto> {
    // 1. Validar existencia del tenant
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    // 2. Validar cuenta origen en el tenant
    const account = await this.accountRepository.findByNumber(
      tenant.getId(),
      input.accountNumber.trim(),
    );
    if (!account) {
      throw new NotFoundException(
        `Cuenta origen '${input.accountNumber}' no encontrada en esta institución.`,
      );
    }

    // 3. Validar estado activo de la cuenta
    if (!account.canTransact()) {
      throw new BadRequestException(
        `No se permite retirar fondos de una cuenta en estado '${account.getStatus()}'.`,
      );
    }

    // 4. Validar monto estrictamente positivo
    const amountNum = Number(input.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException(
        'El monto del retiro debe ser un número estrictamente positivo y mayor a 0.',
      );
    }

    // 5. Validar límite máximo por transacción
    const settings = await this.settingsRepository.findByTenantId(tenant.getId());
    if (settings) {
      const maxLimit = Number(settings.getMaxTransactionAmount());
      if (amountNum > maxLimit) {
        throw new BadRequestException(
          `El monto del retiro (${input.amount}) excede el límite máximo permitido por transacción (${settings.getMaxTransactionAmount()} ${settings.getPrimaryCurrency()}).`,
        );
      }
    }

    // 6. Validar saldo suficiente (CA-HU-08-02)
    const currentBalance = Number(account.getBalance());
    if (currentBalance < amountNum) {
      throw new BadRequestException(
        `Saldo insuficiente para realizar el retiro. Saldo disponible: ${account.getBalance()} ${account.getCurrency()}.`,
      );
    }

    // 7. Debitar saldo
    account.debit(input.amount);

    // 8. Crear Transaction (cabecera con tipo WITHDRAWAL)
    const transaction = Transaction.createWithdrawal({
      tenantId: tenant.getId(),
      sourceAccountId: account.getId(),
      amount: input.amount,
      currency: account.getCurrency(),
      idempotencyKey: input.idempotencyKey,
    });

    // 9. Registrar asiento de débito en Ledger
    const ledgerEntry = LedgerEntry.create({
      tenantId: tenant.getId(),
      transactionId: transaction.getId(),
      accountId: account.getId(),
      type: LedgerEntryType.DEBIT,
      amount: input.amount,
      currency: account.getCurrency(),
    });

    // 10. Persistir cambios de forma consistente
    await this.accountRepository.update(account);
    await this.transactionRepository.save(transaction);
    await this.ledgerRepository.save(ledgerEntry);

    // 11. Devolver respuesta estandarizada
    const response = new WithdrawResponseDto();
    response.transactionId = transaction.getId();
    response.accountNumber = account.getAccountNumber();
    response.amount = transaction.getOriginalAmount();
    response.currency = account.getCurrency();
    response.newBalance = account.getBalance();
    response.status = transaction.getStatus();
    response.createdAt = transaction.getCreatedAt().toISOString();

    return response;
  }
}

