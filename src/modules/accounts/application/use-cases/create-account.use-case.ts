import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { CUSTOMER_REPOSITORY } from '../../../customers/application/ports/customer.repository.port';
import type { CustomerRepository } from '../../../customers/application/ports/customer.repository.port';
import { ACCOUNT_REPOSITORY } from '../ports/account.repository.port';
import type { AccountRepository } from '../ports/account.repository.port';
import { Account } from '../../domain/entities/account.entity';
import { Currency } from '../../../tenants/domain/value-objects/currency.enum';
import { AccountResponseDto } from '../dto/account-response.dto';

export interface CreateAccountInput {
  tenantSlug: string;
  customerId: string;
  currency: Currency;
  accountNumber?: string;
  initialBalance?: string;
}

/**
 * Caso de Uso: Crear Cuenta Bancaria (HU-05)
 *
 * Criterios de Aceptación:
 * - CA-HU-05-01: Administrador y customer del mismo tenant -> crea cuenta activa.
 * - CA-HU-05-02: Customer de otro tenant -> rechaza la operación.
 * - CA-HU-05-03: Número de cuenta existente en el tenant -> 409 Conflict.
 */
@Injectable()
export class CreateAccountUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: CreateAccountInput): Promise<AccountResponseDto> {
    // 1. Validar tenant
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    const tenantId = tenant.getId();

    // 2. Validar que el cliente exista
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID '${input.customerId}' no encontrado.`,
      );
    }

    // 3. Criterio CA-HU-05-02: Validar que el cliente pertenezca al MISMO tenant
    if (customer.getTenantId() !== tenantId) {
      throw new BadRequestException(
        'El cliente indicado no pertenece a esta institución financiera.',
      );
    }

    // 4. Generar o validar número de cuenta único
    const accountNumber =
      input.accountNumber?.trim() || this.generateAccountNumber();

    // 5. Criterio CA-HU-05-03: Verificar que el número de cuenta no esté duplicado en el tenant
    const existingAccount = await this.accountRepository.findByNumber(
      tenantId,
      accountNumber,
    );
    if (existingAccount) {
      throw new ConflictException(
        `El número de cuenta '${accountNumber}' ya existe en esta institución.`,
      );
    }

    // 6. Instanciar y validar la entidad Account
    let account: Account;
    try {
      account = Account.create({
        tenantId,
        customerId: customer.getId(),
        accountNumber,
        currency: input.currency,
        initialBalance: input.initialBalance,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Datos de cuenta inválidos';
      throw new BadRequestException(message);
    }

    // 7. Persistir la cuenta
    await this.accountRepository.save(account);

    return AccountResponseDto.fromDomain(account);
  }

  /**
   * Genera un número de cuenta único aleatorio de 10 dígitos.
   */
  private generateAccountNumber(): string {
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
    return `10${randomSuffix}`;
  }
}

