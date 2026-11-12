import { Account } from '../../domain/entities/account.entity';
import { AccountStatus } from '../../domain/value-objects/account-status.enum';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';

export class AccountResponseDto {
  id: string;
  tenantId: string;
  customerId: string;
  accountNumber: string;
  maskedNumber: string;
  currency: Currency;
  balance: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;

  public static fromDomain(account: Account): AccountResponseDto {
    const rawNumber = account.getAccountNumber();
    const masked =
      rawNumber.length > 4
        ? `****${rawNumber.slice(-4)}`
        : rawNumber;

    const dto = new AccountResponseDto();
    dto.id = account.getId();
    dto.tenantId = account.getTenantId();
    dto.customerId = account.getCustomerId();
    dto.accountNumber = account.getAccountNumber();
    dto.maskedNumber = masked;
    dto.currency = account.getCurrency();
    dto.balance = account.getBalance();
    dto.status = account.getStatus();
    dto.createdAt = account.getCreatedAt().toISOString();
    dto.updatedAt = account.getUpdatedAt().toISOString();
    return dto;
  }
}

