import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RegisterTenantUseCase } from './register-tenant.use-case';
import type { TenantRepository } from '../ports/tenant.repository.port';
import type { SchemaProvisioner } from '../ports/schema-provisioner.port';
import { Tenant } from '../../domain/entities/tenant.entity';
import { TenantStatus } from '../../domain/value-objects/tenant-status.enum';

describe('RegisterTenantUseCase (HU-01)', () => {
  let useCase: RegisterTenantUseCase;
  let tenantRepository: jest.Mocked<TenantRepository>;
  let schemaProvisioner: jest.Mocked<SchemaProvisioner>;

  beforeEach(() => {
    tenantRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findBySlug: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
    };

    schemaProvisioner = {
      provisionSchema: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new RegisterTenantUseCase(tenantRepository, schemaProvisioner);
  });

  it('CA-HU-01-01: debe registrar un tenant y dejarlo en estado ACTIVE tras aprovisionamiento exitoso', async () => {
    const input = { name: 'Banco Santander', slug: 'banco-santander' };

    const result = await useCase.execute(input);

    expect(tenantRepository.findBySlug).toHaveBeenCalledWith('banco-santander');
    expect(tenantRepository.save).toHaveBeenCalledTimes(1);
    expect(schemaProvisioner.provisionSchema).toHaveBeenCalledWith('tenant_banco_santander');
    expect(tenantRepository.update).toHaveBeenCalledTimes(1);

    expect(result.id).toBeDefined();
    expect(result.slug).toBe('banco-santander');
    expect(result.schemaName).toBe('tenant_banco_santander');
    expect(result.status).toBe(TenantStatus.ACTIVE);
  });

  it('CA-HU-01-02: debe lanzar ConflictException si el slug ya se encuentra registrado', async () => {
    const existingTenant = Tenant.create('Banco Existente', 'banco-existente');
    tenantRepository.findBySlug.mockResolvedValue(existingTenant);

    await expect(
      useCase.execute({ name: 'Otro Banco', slug: 'banco-existente' }),
    ).rejects.toThrow(ConflictException);

    expect(tenantRepository.save).not.toHaveBeenCalled();
    expect(schemaProvisioner.provisionSchema).not.toHaveBeenCalled();
  });

  it('CA-HU-01-03: debe lanzar BadRequestException si el slug o nombre no cumple las reglas de formato', async () => {
    await expect(
      useCase.execute({ name: 'OK', slug: 'slug_invalido!' }),
    ).rejects.toThrow(BadRequestException);

    expect(tenantRepository.save).not.toHaveBeenCalled();
  });

  it('CA-HU-01-04: si falla el aprovisionamiento, debe marcar el tenant como FAILED y lanzar InternalServerErrorException', async () => {
    schemaProvisioner.provisionSchema.mockRejectedValue(
      new Error('Fallo de conexión en PostgreSQL'),
    );

    await expect(
      useCase.execute({ name: 'Banco Fallido', slug: 'banco-fallido' }),
    ).rejects.toThrow(InternalServerErrorException);

    // Debe haberse guardado inicialmente en PROVISIONING
    expect(tenantRepository.save).toHaveBeenCalledTimes(1);
    // Y luego haberse actualizado con el estado FAILED
    expect(tenantRepository.update).toHaveBeenCalledTimes(1);
    const updatedTenant = tenantRepository.update.mock.calls[0][0];
    expect(updatedTenant.getStatus()).toBe(TenantStatus.FAILED);
  });
});

