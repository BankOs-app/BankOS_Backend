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
import { TransactionType } from '../../domain/value-objects/transaction-types.enum';
import { UserRole } from '../../../identity/domain/value-objects/user-role.enum';
import { PaginatedTransactionsResponseDto } from '../dto/paginated-transactions-response.dto';
import { TransactionItemDto } from '../dto/transaction-item.dto';

export interface GetTransactionHistoryInput {
  tenantSlug: string;
  userId: string;
  role: string;
  type?: TransactionType;
  startDate?: string;
  endDate?: string;
  accountNumber?: string;
  page: number;
  limit: number;
}

/**
 * Caso de Uso: Consultar Historial de Transacciones con Filtros y Paginación (HU-11)
 *
 * Criterios de Aceptación:
 * - CA-HU-11-01: Deriva tenant y usuario del token autenticado. Si es cliente, solo ve sus cuentas.
 * - CA-HU-11-02: Filtra por tipo de operación (DEPOSIT, WITHDRAWAL, TRANSFER) y rango de fechas.
 * - CA-HU-11-03: Paginación estable con límite y offset sin duplicados.
 * - CA-HU-11-04: Incluye flags visuales `hasFee` y `hasConversion` para la app móvil / UI.
 */
@Injectable()
export class GetTransactionHistoryUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(
    input: GetTransactionHistoryInput,
  ): Promise<PaginatedTransactionsResponseDto> {
    // 1. Validar tenant
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    let authorizedAccountIds: string[] | undefined;

    // 2. Control de acceso: CA-HU-11-01 (cliente solo ve sus cuentas autorizadas)
    if (input.role === UserRole.CUSTOMER) {
      const customerAccounts = await this.accountRepository.listByCustomer(
        input.userId,
      );

      if (customerAccounts.length === 0) {
        return {
          data: [],
          total: 0,
          page: input.page,
          limit: input.limit,
          totalPages: 0,
        };
      }

      if (input.accountNumber) {
        const matching = customerAccounts.find(
          (acc) => acc.getAccountNumber() === input.accountNumber?.trim(),
        );
        if (!matching) {
          throw new NotFoundException(
            `Cuenta '${input.accountNumber}' no encontrada o no pertenece al usuario autenticado.`,
          );
        }
        authorizedAccountIds = [matching.getId()];
      } else {
        authorizedAccountIds = customerAccounts.map((acc) => acc.getId());
      }
    } else {
      // Rol Administrador: puede filtrar por una cuenta o consultar todas las del tenant
      if (input.accountNumber) {
        const acc = await this.accountRepository.findByNumber(
          tenant.getId(),
          input.accountNumber.trim(),
        );
        if (!acc) {
          throw new NotFoundException(
            `Cuenta '${input.accountNumber}' no encontrada en este tenant.`,
          );
        }
        authorizedAccountIds = [acc.getId()];
      }
    }

    // 3. Ejecutar consulta paginada en el repositorio
    const paginated = await this.transactionRepository.findPaginated({
      tenantId: tenant.getId(),
      accountIds: authorizedAccountIds,
      type: input.type,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      page: input.page,
      limit: input.limit,
    });

    // 4. Mapear entidades a DTOs con flags visuales e información institucional enriquecida (CA-HU-11-04)
    const allTenants = await this.tenantRepository.findAll().catch(() => []);
    const tenantNameMap = new Map<string, string>();
    for (const t of allTenants) {
      tenantNameMap.set(t.getId(), t.getName());
      const slugVal =
        typeof t.getSlug() === 'object' && 'getValue' in t.getSlug()
          ? (t.getSlug() as any).getValue()
          : String(t.getSlug());
      tenantNameMap.set(slugVal, t.getName());
    }

    const items: TransactionItemDto[] = await Promise.all(
      paginated.data.map(async (tx) => {
        const feeVal = Number(tx.getFeeAmount() ?? 0);
        const isCrossCurrency = Boolean(
          tx.getDestinationCurrency() &&
            tx.getOriginalCurrency() !== tx.getDestinationCurrency(),
        );

        const dto = new TransactionItemDto();
        dto.id = tx.getId();
        dto.type = tx.getType();
        dto.sourceAccountId = tx.getSourceAccountId();
        dto.destinationAccountId = tx.getDestinationAccountId();
        dto.sourceTenantId = tx.getSourceTenantId();
        dto.destinationTenantId = tx.getDestinationTenantId();

        dto.sourceBankName = dto.sourceTenantId
          ? (tenantNameMap.get(dto.sourceTenantId) ?? dto.sourceTenantId)
          : undefined;
        dto.destinationBankName = dto.destinationTenantId
          ? (tenantNameMap.get(dto.destinationTenantId) ?? dto.destinationTenantId)
          : undefined;

        if (dto.sourceAccountId) {
          try {
            const srcAcc = await this.accountRepository.findById(
              dto.sourceAccountId,
              dto.sourceTenantId,
            );
            if (srcAcc) {
              dto.sourceAccountNumber = srcAcc.getAccountNumber();
            }
          } catch (_) {}
        }

        if (dto.destinationAccountId) {
          try {
            const dstAcc = await this.accountRepository.findById(
              dto.destinationAccountId,
              dto.destinationTenantId,
            );
            if (dstAcc) {
              dto.destinationAccountNumber = dstAcc.getAccountNumber();
            }
          } catch (_) {}
        }

        dto.originalAmount = tx.getOriginalAmount();
        dto.originalCurrency = tx.getOriginalCurrency();
        dto.convertedAmount = tx.getConvertedAmount();
        dto.destinationCurrency = tx.getDestinationCurrency();
        dto.exchangeRateApplied = tx.getExchangeRateApplied();
        dto.feeAmount = tx.getFeeAmount();
        dto.totalDebited =
          feeVal > 0
            ? (Number(tx.getOriginalAmount()) + feeVal).toFixed(2)
            : tx.getOriginalAmount();
        dto.hasFee = feeVal > 0;
        dto.hasConversion = isCrossCurrency;
        dto.status = tx.getStatus();
        dto.createdAt = tx.getCreatedAt().toISOString();
        return dto;
      }),
    );

    const totalPages = Math.ceil(paginated.total / paginated.limit);

    return {
      data: items,
      total: paginated.total,
      page: paginated.page,
      limit: paginated.limit,
      totalPages: totalPages === 0 && paginated.total === 0 ? 0 : Math.max(totalPages, 1),
    };
  }
}
