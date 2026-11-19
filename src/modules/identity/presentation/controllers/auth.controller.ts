import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtTokenService } from '../../infrastructure/security/jwt-token.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../../domain/value-objects/authenticated-user.vo';
import { UserRole } from '../../domain/value-objects/user-role.enum';
import { UserStatus } from '../../domain/value-objects/user-status.enum';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { USER_REPOSITORY } from '../../application/ports/user.repository.port';
import type { UserRepository } from '../../application/ports/user.repository.port';

export class LoginRequestDto {
  @ApiProperty({
    example: 'banco-bogota',
    description:
      'Slug o identificador de la institución bancaria a la que pertenece el usuario (Requerimiento oficial Línea 72 de Proyecto.txt)',
  })
  @IsString()
  @IsNotEmpty({
    message: 'El identificador del banco (tenantSlug) es obligatorio para iniciar sesión.',
  })
  tenantSlug: string;

  @ApiProperty({
    example: 'carlos@bogota.com',
    description: 'Correo electrónico registrado del usuario o cliente bancario',
  })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  email: string;

  @ApiProperty({
    example: '1234',
    description: 'PIN de acceso de exactamente 4 dígitos numéricos',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/, {
    message: 'El PIN debe contener exactamente 4 dígitos numéricos (ej. 1234).',
  })
  password?: string;

  @ApiPropertyOptional({
    example: '1234',
    description: 'Alias del PIN de 4 dígitos',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/, {
    message: 'El PIN debe contener exactamente 4 dígitos numéricos (ej. 1234).',
  })
  pin?: string;
}

export class IssueDevTokenDto {
  @ApiProperty({ example: 'usr-admin-1', description: 'ID del usuario' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'tnt-uuid-1', description: 'UUID del tenant' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ example: 'banco-bogota', description: 'Slug del tenant' })
  @IsString()
  @IsNotEmpty()
  tenantSlug: string;

  @ApiProperty({ example: 'admin@bancobogota.com', description: 'Email del usuario' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ADMIN, description: 'Rol asignado' })
  @IsEnum(UserRole)
  role: UserRole;
}

@ApiTags('Identidad y Acceso (HU-03)')
@Controller('identity')
export class AuthController {
  constructor(
    private readonly tokenService: JwtTokenService,
    @Optional()
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository?: TenantRepository,
    @Optional()
    @Inject(USER_REPOSITORY)
    private readonly userRepository?: UserRepository,
  ) {}

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión (Flujo oficial de App Móvil Flutter / Web)',
    description:
      'Requerimiento oficial Línea 72 de Proyecto.txt: "El inicio de sesión debe requerir las credenciales del usuario y el identificador/slug del tenant al que pertenece". ' +
      'Valida que el banco exista, que el usuario pertenezca a él, que su PIN/contraseña coincida y que esté activo, devolviendo el JWT y su perfil.',
  })
  @ApiResponse({ status: 200, description: 'Inicio de sesión exitoso y token generado.' })
  async login(@Body() dto: LoginRequestDto) {
    if (!this.tenantRepository || !this.userRepository) {
      throw new BadRequestException('Servicio de repositorios no disponible.');
    }

    if (!dto.tenantSlug || dto.tenantSlug.trim() === '') {
      throw new BadRequestException(
        'El identificador del banco (tenantSlug) es obligatorio para iniciar sesión.',
      );
    }

    const tenant = await this.tenantRepository.findBySlug(
      dto.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(
        `La institución bancaria con identificador '${dto.tenantSlug}' no existe.`,
      );
    }

    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(tenant.getId(), email);
    if (!user) {
      throw new UnauthorizedException(
        `No existe ningún usuario registrado con el correo '${dto.email}' en ${tenant.getName()}.`,
      );
    }

    if (user.getStatus() !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        `La cuenta del usuario '${dto.email}' se encuentra inactiva o bloqueada.`,
      );
    }

    const rawPin = dto.pin || dto.password;
    if (!user.verifyPassword(rawPin)) {
      throw new UnauthorizedException('El PIN de 4 dígitos ingresado es incorrecto.');
    }

    const tenantSlug =
      typeof tenant.getSlug() === 'object' && 'getValue' in tenant.getSlug()
        ? tenant.getSlug().getValue()
        : String(tenant.getSlug());

    const token = this.tokenService.generateToken({
      userId: user.getId(),
      tenantId: tenant.getId(),
      tenantSlug: tenantSlug,
      email: user.getEmail(),
      role: user.getRole(),
    });

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      user: {
        userId: user.getId(),
        tenantId: tenant.getId(),
        tenantSlug: tenantSlug,
        tenantName: tenant.getName(),
        email: user.getEmail(),
        role: user.getRole(),
      },
    };
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar token JWT para pruebas y demostración de jueces (Con Rate Limiting)',
    description:
      'Emite un token firmado con los claims obligatorios (tenant_id, user_id, role). Protegido con Rate Limiting de 10 peticiones/minuto por IP contra fuerza bruta.',
  })
  @ApiResponse({ status: 200, description: 'Token JWT generado exitosamente.' })
  issueToken(@Body() dto: IssueDevTokenDto) {
    const token = this.tokenService.generateToken({
      userId: dto.userId,
      tenantId: dto.tenantId,
      tenantSlug: dto.tenantSlug,
      email: dto.email,
      role: dto.role,
    });

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      user: {
        userId: dto.userId,
        tenantId: dto.tenantId,
        tenantSlug: dto.tenantSlug,
        email: dto.email,
        role: dto.role,
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar contexto del usuario autenticado actual',
  })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      userId: user.userId,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      email: user.email,
      role: user.role,
    };
  }
}

