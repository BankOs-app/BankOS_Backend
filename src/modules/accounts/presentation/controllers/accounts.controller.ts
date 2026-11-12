import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../identity/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../../identity/presentation/guards/roles.guard';
import { TenantMatchGuard } from '../../../identity/presentation/guards/tenant-match.guard';
import { Roles } from '../../../identity/presentation/decorators/roles.decorator';
import { UserRole } from '../../../identity/domain/value-objects/user-role.enum';
import { CreateAccountUseCase } from '../../application/use-cases/create-account.use-case';
import { GetAccountUseCase } from '../../application/use-cases/get-account.use-case';
import { UpdateAccountStatusUseCase } from '../../application/use-cases/update-account-status.use-case';
import { CreateAccountRequestDto } from '../dto/create-account.request.dto';
import { UpdateAccountStatusRequestDto } from '../dto/update-account-status.request.dto';
import { AccountResponseDto } from '../../application/dto/account-response.dto';

@ApiTags('Cuentas Bancarias (HU-05)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantMatchGuard)
@Controller('tenants/:slug/accounts')
export class AccountsController {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly getAccountUseCase: GetAccountUseCase,
    private readonly updateAccountStatusUseCase: UpdateAccountStatusUseCase,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una nueva cuenta bancaria para un cliente (Solo Administrador)',
    description:
      'Crea una cuenta bancaria con saldo y número único, asociada obligatoriamente a un cliente del mismo tenant.',
  })
  @ApiCreatedResponse({
    description: 'Cuenta bancaria creada exitosamente en estado ACTIVE.',
    type: AccountResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'El cliente no pertenece al tenant o datos inválidos.',
  })
  @ApiConflictResponse({
    description: 'El número de cuenta ya se encuentra registrado en el tenant.',
  })
  async create(
    @Param('slug') slug: string,
    @Body() dto: CreateAccountRequestDto,
  ): Promise<AccountResponseDto> {
    return this.createAccountUseCase.execute({
      tenantSlug: slug,
      customerId: dto.customerId,
      currency: dto.currency,
      accountNumber: dto.accountNumber,
      initialBalance: dto.initialBalance,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Listar todas las cuentas bancarias de la institución (Solo Administrador)',
  })
  @ApiOkResponse({ type: [AccountResponseDto] })
  async listAll(@Param('slug') slug: string): Promise<AccountResponseDto[]> {
    return this.getAccountUseCase.listAll(slug);
  }

  @Get('customer/:customerId')
  @ApiOperation({
    summary: 'Consultar cuentas bancarias pertenecientes a un cliente específico',
  })
  @ApiOkResponse({ type: [AccountResponseDto] })
  async listByCustomer(
    @Param('slug') slug: string,
    @Param('customerId') customerId: string,
  ): Promise<AccountResponseDto[]> {
    return this.getAccountUseCase.listByCustomer(slug, customerId);
  }

  @Get(':accountNumber')
  @ApiOperation({
    summary: 'Consultar el detalle de una cuenta bancaria por su número',
  })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: 'Cuenta bancaria no encontrada.' })
  async findByNumber(
    @Param('slug') slug: string,
    @Param('accountNumber') accountNumber: string,
  ): Promise<AccountResponseDto> {
    return this.getAccountUseCase.findByNumber(slug, accountNumber);
  }

  @Patch(':accountNumber/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Actualizar estado de una cuenta (Bloqueo o Borrado Lógico / Soft Delete)',
    description:
      'Permite pasar una cuenta a ACTIVE, BLOCKED o INACTIVE. Las cuentas inactivas no pueden operar financieramente.',
  })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiNotFoundResponse({ description: 'Cuenta bancaria no encontrada.' })
  async updateStatus(
    @Param('slug') slug: string,
    @Param('accountNumber') accountNumber: string,
    @Body() dto: UpdateAccountStatusRequestDto,
  ): Promise<AccountResponseDto> {
    return this.updateAccountStatusUseCase.execute(slug, accountNumber, dto.status);
  }
}

