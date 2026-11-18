import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../identity/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../identity/presentation/guards/roles.guard';
import { TenantMatchGuard } from '../../../identity/presentation/guards/tenant-match.guard';
import { Roles } from '../../../identity/presentation/decorators/roles.decorator';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import { UserRole } from '../../../identity/domain/value-objects/user-role.enum';
import { AuthenticatedUser } from '../../../identity/domain/value-objects/authenticated-user.vo';
import { CreateCustomerUseCase } from '../../application/use-cases/create-customer.use-case';
import { GetCustomerUseCase } from '../../application/use-cases/get-customer.use-case';
import { CreateCustomerRequestDto } from '../dto/create-customer.request.dto';
import { CustomerResponseDto } from '../../application/dto/customer-response.dto';

@ApiTags('Customers & Users (HU-04)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantMatchGuard)
@Controller('tenants/:slug/customers')
export class CustomersController {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un nuevo cliente bancario en el tenant (Solo Administrador)',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiConflictResponse({
    description: 'Documento o email ya registrado en el tenant.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado: rol no autorizado o violación de tenant.',
  })
  async create(
    @Param('slug') slug: string,
    @Body() dto: CreateCustomerRequestDto,
  ): Promise<CustomerResponseDto> {
    return this.createCustomerUseCase.execute({
      tenantSlug: slug,
      fullName: dto.fullName,
      documentNumber: dto.documentNumber,
      email: dto.email,
      phone: dto.phone,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Listar todos los clientes del tenant (Solo Administrador)',
  })
  @ApiOkResponse({ type: [CustomerResponseDto] })
  async listAll(@Param('slug') slug: string): Promise<CustomerResponseDto[]> {
    return this.getCustomerUseCase.listAll(slug);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Consultar la ficha del cliente autenticado actual',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  async getMyProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    return this.getCustomerUseCase.findByUserId(user.userId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Consultar un cliente por su ID dentro del tenant',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiNotFoundResponse({ description: 'Cliente no encontrado en este tenant.' })
  async findById(
    @Param('slug') slug: string,
    @Param('id') id: string,
  ): Promise<CustomerResponseDto> {
    return this.getCustomerUseCase.findById(slug, id);
  }
}

