import { Tenant } from '../../domain/entities/tenant.entity';
import { TenantStatus } from '../../domain/value-objects/tenant-status.enum';

/**
 * DTO que representa la respuesta pública con la información completa de un Tenant.
 */
export class TenantResponseDto {
  id: string;
  name: string;
  slug: string;
  schemaName: string;
  status: TenantStatus;
  primaryCurrency: string;
  maxTransactionAmount: string;
  feeType: string;
  feeValue: string;
  createdAt: string;
  updatedAt: string;

  /**
   * Mapeador estático de la Entidad de Dominio hacia el DTO de salida.
   */
  public static fromDomain(tenant: Tenant): TenantResponseDto {
    const dto = new TenantResponseDto();
    dto.id = tenant.getId();
    dto.name = tenant.getName();
    dto.slug = tenant.getSlug().getValue();
    dto.schemaName = tenant.getSchemaName();
    dto.status = tenant.getStatus();
    dto.primaryCurrency = tenant.getPrimaryCurrency();
    dto.maxTransactionAmount = tenant.getMaxTransactionAmount();
    dto.feeType = tenant.getFeeType();
    dto.feeValue = tenant.getFeeValue();
    dto.createdAt = tenant.getCreatedAt().toISOString();
    dto.updatedAt = tenant.getUpdatedAt().toISOString();
    return dto;
  }
}
