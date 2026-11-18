import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { UserRole } from '../../../identity/domain/value-objects/user-role.enum';
import { GetAuditLogsUseCase } from '../../application/use-cases/get-audit-logs.use-case';
import { AuditQueryDto } from '../dto/audit-query.dto';
import { PaginatedAuditLogsResponseDto } from '../../application/dto/audit-log-response.dto';

@ApiTags('Auditoría Administrativa (HU-14)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantMatchGuard)
@Controller('tenants/:slug/audit')
export class AuditController {
  constructor(private readonly getAuditLogsUseCase: GetAuditLogsUseCase) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Consultar registro de auditoría inmutable del tenant (Solo Administrador - HU-14)',
    description:
      'Retorna las acciones administrativas ejecutadas en el tenant (cambios de configuración, tasas, comisiones, cuentas y usuarios) con valores anteriores y nuevos.',
  })
  @ApiOkResponse({
    description: 'Registros de auditoría obtenidos exitosamente.',
    type: PaginatedAuditLogsResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado: el usuario no tiene rol de administrador (CA-HU-14-02).',
  })
  @ApiNotFoundResponse({
    description: 'Tenant no encontrado.',
  })
  async getAuditLogs(
    @Param('slug') slug: string,
    @Query() query: AuditQueryDto,
  ): Promise<PaginatedAuditLogsResponseDto> {
    return this.getAuditLogsUseCase.execute({
      tenantSlug: slug,
      action: query.action,
      resource: query.resource,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page,
      limit: query.limit,
    });
  }
}

