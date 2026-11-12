import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { ACCOUNT_REPOSITORY } from '../../../accounts/application/ports/account.repository.port';
import type { AccountRepository } from '../../../accounts/application/ports/account.repository.port';
import { TRANSACTION_REPOSITORY } from '../ports/transaction.repository.port';
import type { TransactionRepository } from '../ports/transaction.repository.port';
import { LEDGER_REPOSITORY } from '../../../ledger/application/ports/ledger.repository.port';
import type { LedgerRepository } from '../../../ledger/application/ports/ledger.repository.port';
import { UserRole } from '../../../identity/domain/value-objects/user-role.enum';
import { TransactionDetailResponseDto } from '../dto/transaction-detail-response.dto';

export interface GetTransactionDetailInput {
  tenantSlug: string;
  transactionId: string;
  userId: string;
  role: string;
}

/**
 * Caso de Uso: Consultar Detalle de Transacción Bancaria (HU-11 - T04, CA-HU-11-05)
 *
 * Flujo:
 * 1. Validar existencia del tenant.
 * 2. Buscar la transacción por ID y asegurar pertenencia al tenant.
 * 3. Si el usuario es un cliente ('customer'), validar que sea titular de la cuenta origen o destino.
 *    Si no lo es, responder 404 Not Found para no filtrar información ni existencia.
 * 4. Obtener asientos contables del libro mayor (Ledger) vinculados a la transacción.
 */
@Injectable()
export class GetTransactionDetailUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    @Inject(LEDGER_REPOSITORY)
    private readonly ledgerRepository: LedgerRepository,
  ) {}

  async execute(
    input: GetTransactionDetailInput,
  ): Promise<TransactionDetailResponseDto> {
    // 1. Validar tenant
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    // 2. Buscar transacción por ID
    const tx = await this.transactionRepository.findById(input.transactionId.trim());
    if (!tx || tx.getTenantId() !== tenant.getId()) {
      throw new NotFoundException('Transacción no encontrada.');
    }

    // 3. Control de acceso: CA-HU-11-05 (ID ajeno no recibe información)
    if (input.role === UserRole.CUSTOMER) {
      const customerAccounts = await this.accountRepository.listByCustomer(
        input.userId,
      );

      const customerAccountIds = new Set(customerAccounts.map((a) => a.getId()));
      const isSourceOwner =
        tx.getSourceAccountId() && customerAccountIds.has(tx.getSourceAccountId()!);
      const isDestOwner =
        tx.getDestinationAccountId() &&
        customerAccountIds.has(tx.getDestinationAccountId()!);

      if (!isSourceOwner && !isDestOwner) {
        throw new NotFoundException('Transacción no encontrada.');
      }
    }

    // 4. Obtener asientos de Ledger vinculados
    const ledgerEntries = await this.ledgerRepository.listByTransaction(tx.getId());

    // 5. Construir respuesta detallada con flags visuales
    const feeVal = Number(tx.getFeeAmount() ?? 0);
    const isCrossCurrency = Boolean(
      tx.getDestinationCurrency() &&
        tx.getOriginalCurrency() !== tx.getDestinationCurrency(),
    );

    const detail = new TransactionDetailResponseDto();
    detail.id = tx.getId();
    detail.type = tx.getType();
    detail.sourceAccountId = tx.getSourceAccountId();
    detail.destinationAccountId = tx.getDestinationAccountId();
    detail.originalAmount = tx.getOriginalAmount();
    detail.originalCurrency = tx.getOriginalCurrency();
    detail.convertedAmount = tx.getConvertedAmount();
    detail.destinationCurrency = tx.getDestinationCurrency();
    detail.exchangeRateApplied = tx.getExchangeRateApplied();
    detail.feeAmount = tx.getFeeAmount();
    detail.hasFee = feeVal > 0;
    detail.hasConversion = isCrossCurrency;
    detail.status = tx.getStatus();
    detail.createdAt = tx.getCreatedAt().toISOString();

    detail.ledgerEntries = ledgerEntries.map((entry) => ({
      id: entry.getId(),
      accountId: entry.getAccountId(),
      type: entry.getType(),
      amount: entry.getAmount(),
      currency: entry.getCurrency(),
      createdAt: entry.getCreatedAt().toISOString(),
    }));

    return detail;
  }
}
