import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { USER_REPOSITORY } from '../../../identity/application/ports/user.repository.port';
import type { UserRepository } from '../../../identity/application/ports/user.repository.port';
import { CUSTOMER_REPOSITORY } from '../ports/customer.repository.port';
import type { CustomerRepository } from '../ports/customer.repository.port';
import { User } from '../../../identity/domain/entities/user.entity';
import { UserRole } from '../../../identity/domain/value-objects/user-role.enum';
import { Customer } from '../../domain/entities/customer.entity';
import { CustomerResponseDto } from '../dto/customer-response.dto';

export interface CreateCustomerInput {
  tenantSlug: string;
  fullName: string;
  documentNumber: string;
  email: string;
  phone?: string;
}

/**
 * Caso de Uso: Registrar Cliente y Usuario Bancario (HU-04)
 *
 * Flujo:
 * 1. Resuelve el tenant por slug.
 * 2. Valida unicidad de documento y correo dentro del tenant.
 * 3. Crea el User local con rol CUSTOMER.
 * 4. Crea la ficha del Customer vinculado al userId.
 * 5. Persiste ambas entidades.
 */
@Injectable()
export class CreateCustomerUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async execute(input: CreateCustomerInput): Promise<CustomerResponseDto> {
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(
        `No existe el tenant con slug '${input.tenantSlug}'`,
      );
    }

    const tenantId = tenant.getId();

    // 1. Validar que no exista otro cliente con el mismo documento en este tenant
    const existingDoc = await this.customerRepository.findByDocumentNumber(
      tenantId,
      input.documentNumber.trim(),
    );
    if (existingDoc) {
      throw new ConflictException(
        `Ya existe un cliente registrado con el documento '${input.documentNumber}' en esta institución.`,
      );
    }

    // 2. Validar que no exista un usuario con el mismo email en este tenant
    const existingUser = await this.userRepository.findByEmail(
      tenantId,
      input.email.trim().toLowerCase(),
    );
    if (existingUser) {
      throw new ConflictException(
        `El correo '${input.email}' ya se encuentra registrado en esta institución.`,
      );
    }

    // 3. Crear entidad User
    const user = User.create({
      tenantId,
      email: input.email,
      role: UserRole.CUSTOMER,
    });

    // 4. Crear entidad Customer vinculada
    const customer = Customer.create({
      tenantId,
      userId: user.getId(),
      fullName: input.fullName,
      documentNumber: input.documentNumber,
      email: input.email,
      phone: input.phone,
    });

    // 5. Persistir ambas entidades
    await this.userRepository.save(user);
    await this.customerRepository.save(customer);

    return CustomerResponseDto.fromDomain(customer);
  }
}

