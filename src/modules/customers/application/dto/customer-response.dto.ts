import { Customer } from '../../domain/entities/customer.entity';

export class CustomerResponseDto {
  id: string;
  tenantId: string;
  userId: string;
  fullName: string;
  documentNumber: string;
  email: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;

  public static fromDomain(customer: Customer): CustomerResponseDto {
    const dto = new CustomerResponseDto();
    dto.id = customer.getId();
    dto.tenantId = customer.getTenantId();
    dto.userId = customer.getUserId();
    dto.fullName = customer.getFullName();
    dto.documentNumber = customer.getDocumentNumber();
    dto.email = customer.getEmail();
    dto.phone = customer.getPhone();
    dto.createdAt = customer.getCreatedAt().toISOString();
    dto.updatedAt = customer.getUpdatedAt().toISOString();
    return dto;
  }
}

