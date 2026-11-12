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
import { DepositResponseDto } from '../dto/deposit-response.dto';

export interface DepositInput {
  tenantSlug: string;
  accountNumber: string;
  amount: string;
  idempotencyKey: string;
}

/**
 * Caso de Uso: Realizar Depósito a Cuenta Activa (HU-07)
 *
 * Flujo:
 * 1. Validar tenant y pertenencia.
 * 2. Validar que la cuenta exista y esté en estado ACTIVE.
 * 3. Validar que el monto sea estrictamente mayor a 0 y no supere el límite del tenant.
 * 4. Acreditar saldo atómicamente.
 * 5. Persistir Transaction (cabecera) y LedgerEntry (asiento crédito).
 */
@Injectable()
export class DepositUseCase {
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

  async execute(input: DepositInput): Promise<DepositResponseDto> {
    // 1. Validar tenant
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    // 2. Validar cuenta de destino en el tenant
    const account = await this.accountRepository.findByNumber(
      tenant.getId(),
      input.accountNumber.trim(),
    );
    if (!account) {
      throw new NotFoundException(
        `Cuenta destino '${input.accountNumber}' no encontrada en esta institución.`,
      );
    }

    // 3. Criterio CA-HU-07-03: Validar estado activo de la cuenta
    if (!account.canTransact()) {
      throw new BadRequestException(
        `No se permite depositar fondos en una cuenta en estado '${account.getStatus()}'.`,
      );
    }

    // 4. Criterio CA-HU-07-02: Validar monto positivo
    const amountNum = Number(input.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestException(
        'El monto del depósito debe ser un número estrictamente positivo y mayor a 0.',
      );
    }

    // 5. Validar límite máximo configurado por el tenant
    const settings = await this.settingsRepository.findByTenantId(tenant.getId());
    if (settings) {
      const maxLimit = Number(settings.getMaxTransactionAmount());
      if (amountNum > maxLimit) {
        throw new BadRequestException(
          `El monto del depósito (${input.amount}) excede el límite máximo permitido por transacción (${settings.getMaxTransactionAmount()} ${settings.getPrimaryCurrency()}).`,
        );
      }
    }

    // 6. Acreditar saldo en la entidad Account
    account.credit(input.amount);

    // 7. Crear transacción (cabecera)
    const transaction = Transaction.createDeposit({
      tenantId: tenant.getId(),
      destinationAccountId: account.getId(),
      amount: input.amount,
      currency: account.getCurrency(),
      idempotencyKey: input.idempotencyKey,
    });

    // 8. Crear asiento contable crédito en el Ledger
    const ledgerEntry = LedgerEntry.create({
      tenantId: tenant.getId(),
      transactionId: transaction.getId(),
      accountId: account.getId(),
      type: LedgerEntryType.CREDIT,
      amount: input.amount,
      currency: account.getCurrency(),
    });

    // 9. Persistir todos los cambios de forma consistente
    await this.accountRepository.update(account);
    await this.transactionRepository.save(transaction);
    await this.ledgerRepository.save(ledgerEntry);

    // 10. Retornar DTO de respuesta
    const response = new DepositResponseDto();
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

