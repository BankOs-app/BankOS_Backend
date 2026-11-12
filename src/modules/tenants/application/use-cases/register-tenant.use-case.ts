import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Tenant } from '../../domain/entities/tenant.entity';
import { TENANT_REPOSITORY } from '../ports/tenant.repository.port';
import type { TenantRepository } from '../ports/tenant.repository.port';
import { SCHEMA_PROVISIONER } from '../ports/schema-provisioner.port';
import type { SchemaProvisioner } from '../ports/schema-provisioner.port';
import { TenantResponseDto } from '../dto/tenant-response.dto';

export interface RegisterTenantInput {
  name: string;
  slug: string;
}

/**
 * Caso de Uso: Registrar Tenant (HU-01)
 *
 * Flujo funcional:
 * 1. Validar unicidad del slug en el registro central (public.tenants).
 * 2. Crear la entidad Tenant con estado PROVISIONING y generar el nombre de esquema seguro.
 * 3. Persistir el tenant en estado PROVISIONING.
 * 4. Aprovisionar el esquema aislado en PostgreSQL (`CREATE SCHEMA IF NOT EXISTS ...`).
 * 5. Si el aprovisionamiento es exitoso, marcar el tenant como ACTIVE y actualizar.
 * 6. Si falla, marcar el tenant como FAILED y registrar el error.
 */
@Injectable()
export class RegisterTenantUseCase {
  private readonly logger = new Logger(RegisterTenantUseCase.name);

  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(SCHEMA_PROVISIONER)
    private readonly schemaProvisioner: SchemaProvisioner,
  ) {}

  async execute(input: RegisterTenantInput): Promise<TenantResponseDto> {
    this.logger.log(`Iniciando registro para el tenant slug: ${input.slug}`);

    // 1. Validar que no exista otro tenant con el mismo slug (Criterio CA-HU-01-02)
    const normalizedSlug = input.slug?.trim().toLowerCase();
    const existingTenant = await this.tenantRepository.findBySlug(normalizedSlug);
    if (existingTenant) {
      this.logger.warn(`El slug '${normalizedSlug}' ya se encuentra registrado.`);
      throw new ConflictException(
        `El slug '${normalizedSlug}' ya está en uso por otra institución.`,
      );
    }

    // 2. Instanciar la entidad Tenant aplicando las reglas de dominio
    let tenant: Tenant;
    try {
      tenant = Tenant.create(input.name, input.slug);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Datos inválidos';
      throw new BadRequestException(message);
    }

    // 3. Persistir inicialmente con estado PROVISIONING
    await this.tenantRepository.save(tenant);
    this.logger.log(
      `Tenant creado con ID ${tenant.getId()} en estado PROVISIONING. Iniciando esquema ${tenant.getSchemaName()}`,
    );

    // 4. Aprovisionar el esquema en PostgreSQL (Criterio CA-HU-01-04)
    try {
      await this.schemaProvisioner.provisionSchema(tenant.getSchemaName());

      // Si todo sale bien, activamos el tenant
      tenant.markAsActive();
      await this.tenantRepository.update(tenant);
      this.logger.log(
        `Esquema '${tenant.getSchemaName()}' creado exitosamente. Tenant activo.`,
      );
    } catch (provisionError) {
      this.logger.error(
        `Fallo al aprovisionar el esquema '${tenant.getSchemaName()}' para el tenant ${tenant.getId()}`,
        provisionError,
      );

      // En caso de fallo, se actualiza a FAILED para evitar operaciones (Criterio CA-HU-01-04)
      tenant.markAsFailed();
      await this.tenantRepository.update(tenant);

      throw new InternalServerErrorException(
        'Ocurrió un error al aprovisionar el espacio de datos aislado del tenant. El registro quedó en estado FAILED.',
      );
    }

    return TenantResponseDto.fromDomain(tenant);
  }
}
