import { Customer } from '../../domain/entities/customer.entity';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface CustomerRepository {
  save(customer: Customer): Promise<void>;
  update(customer: Customer): Promise<void>;
  findById(id: string): Promise<Customer | null>;
  findByUserId(userId: string): Promise<Customer | null>;
  findByDocumentNumber(
    tenantId: string,
    documentNumber: string,
  ): Promise<Customer | null>;
  listByTenant(tenantId: string): Promise<Customer[]>;
}

