import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RegisterTenantUseCase } from '../../application/use-cases/register-tenant.use-case';
import { GetTenantUseCase } from '../../application/use-cases/get-tenant.use-case';
import { CreateTenantRequestDto } from '../dto/create-tenant.request.dto';
import { TenantResponseDto } from '../../application/dto/tenant-response.dto';

/**
 * Controlador REST para la gestión de Tenants.
 *
 * Ruta base: `/api/v1/tenants` (gracias al prefijo global de NestJS).
 */
@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly registerTenantUseCase: RegisterTenantUseCase,
    private readonly getTenantUseCase: GetTenantUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un nuevo tenant y aprovisionar su esquema de base de datos',
    description:
      'Crea el tenant en public.tenants con estado PROVISIONING, crea su esquema aislado y lo activa.',
  })
  @ApiCreatedResponse({
    description: 'Tenant registrado y aprovisionado exitosamente.',
    type: TenantResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos o formato de slug no permitido.',
  })
  @ApiConflictResponse({
    description: 'Ya existe un tenant registrado con el slug especificado.',
  })
  async register(
    @Body() dto: CreateTenantRequestDto,
  ): Promise<TenantResponseDto> {
    return this.registerTenantUseCase.execute({
      name: dto.name,
      slug: dto.slug,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todas las instituciones financieras registradas',
  })
  @ApiOkResponse({
    description: 'Listado de tenants.',
    type: [TenantResponseDto],
  })
  async findAll(): Promise<TenantResponseDto[]> {
    return this.getTenantUseCase.findAll();
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Consultar el detalle de un tenant por su slug',
  })
  @ApiOkResponse({
    description: 'Datos del tenant.',
    type: TenantResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No existe ningún tenant con el slug solicitado.',
  })
  async findBySlug(@Param('slug') slug: string): Promise<TenantResponseDto> {
    return this.getTenantUseCase.findBySlug(slug);
  }
}

