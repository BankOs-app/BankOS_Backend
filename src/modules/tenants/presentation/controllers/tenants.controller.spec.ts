import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { RegisterTenantUseCase } from '../../application/use-cases/register-tenant.use-case';
import { GetTenantUseCase } from '../../application/use-cases/get-tenant.use-case';
import { TenantStatus } from '../../domain/value-objects/tenant-status.enum';
import { TenantResponseDto } from '../../application/dto/tenant-response.dto';

describe('TenantsController', () => {
  let controller: TenantsController;
  let registerTenantUseCase: jest.Mocked<RegisterTenantUseCase>;
  let getTenantUseCase: jest.Mocked<GetTenantUseCase>;

  beforeEach(async () => {
    registerTenantUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RegisterTenantUseCase>;

    getTenantUseCase = {
      findBySlug: jest.fn(),
      findAll: jest.fn(),
    } as unknown as jest.Mocked<GetTenantUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: RegisterTenantUseCase,
          useValue: registerTenantUseCase,
        },
        {
          provide: GetTenantUseCase,
          useValue: getTenantUseCase,
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  it('debe registrar un tenant a través del caso de uso', async () => {
    const mockResponse: TenantResponseDto = {
      id: 'uuid-1234',
      name: 'Banco Prueba',
      slug: 'banco-prueba',
      schemaName: 'tenant_banco_prueba',
      status: TenantStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    registerTenantUseCase.execute.mockResolvedValue(mockResponse);

    const result = await controller.register({
      name: 'Banco Prueba',
      slug: 'banco-prueba',
    });

    expect(registerTenantUseCase.execute).toHaveBeenCalledWith({
      name: 'Banco Prueba',
      slug: 'banco-prueba',
    });
    expect(result).toEqual(mockResponse);
  });

  it('debe consultar un tenant por su slug', async () => {
    const mockResponse: TenantResponseDto = {
      id: 'uuid-1234',
      name: 'Banco Prueba',
      slug: 'banco-prueba',
      schemaName: 'tenant_banco_prueba',
      status: TenantStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    getTenantUseCase.findBySlug.mockResolvedValue(mockResponse);

    const result = await controller.findBySlug('banco-prueba');
    expect(getTenantUseCase.findBySlug).toHaveBeenCalledWith('banco-prueba');
    expect(result).toEqual(mockResponse);
  });
});

