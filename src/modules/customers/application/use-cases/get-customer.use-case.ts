import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { CUSTOMER_REPOSITORY } from '../ports/customer.repository.port';
import type { CustomerRepository } from '../ports/customer.repository.port';
import { CustomerResponseDto } from '../dto/customer-response.dto';

@Injectable()
export class GetCustomerUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: CustomerRepository,
  ) {}

  async listAll(tenantSlug: string): Promise<CustomerResponseDto[]> {
    const tenant = await this.tenantRepository.findBySlug(
      tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${tenantSlug}'`);
    }

    const customers = await this.customerRepository.listByTenant(
      tenant.getId(),
    );
    return customers.map((c) => CustomerResponseDto.fromDomain(c));
  }

  async findById(
    tenantSlug: string,
    customerId: string,
  ): Promise<CustomerResponseDto> {
    const tenant = await this.tenantRepository.findBySlug(
      tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${tenantSlug}'`);
    }

    const customer = await this.customerRepository.findById(customerId);
    // Criterio CA-HU-04-04: Si el cliente no existe o pertenece a otro tenant, no se revela
    if (!customer || customer.getTenantId() !== tenant.getId()) {
      throw new NotFoundException(
        `Cliente no encontrado en esta institución.`,
      );
    }

    return CustomerResponseDto.fromDomain(customer);
  }

  async findByUserId(userId: string): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findByUserId(userId);
    if (!customer) {
      throw new NotFoundException('Ficha de cliente no encontrada.');
    }
    return CustomerResponseDto.fromDomain(customer);
  }
}

