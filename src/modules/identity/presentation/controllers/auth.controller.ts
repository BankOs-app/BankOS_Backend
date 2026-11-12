import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtTokenService } from '../../infrastructure/security/jwt-token.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../../domain/value-objects/authenticated-user.vo';
import { UserRole } from '../../domain/value-objects/user-role.enum';
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  constructor(private readonly tokenService: JwtTokenService) {}

  @Public()
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar token JWT para pruebas y demostración de jueces',
    description:
      'Emite un token firmado con los claims obligatorios (tenant_id, user_id, role) según especificación.',
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

