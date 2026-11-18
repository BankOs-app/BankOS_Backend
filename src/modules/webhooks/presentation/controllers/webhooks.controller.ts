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
  ApiCreatedResponse,
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
import { RegisterWebhookUseCase } from '../../application/use-cases/register-webhook.use-case';
import { ListWebhooksUseCase } from '../../application/use-cases/list-webhooks.use-case';
import { OutboxDispatcherService } from '../../application/services/outbox-dispatcher.service';
import { RegisterWebhookRequestDto } from '../dto/register-webhook.request.dto';

@ApiTags('Webhooks & Notificaciones Outbox (HU-15)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, TenantMatchGuard)
@Controller('tenants/:slug/webhooks')
export class WebhooksController {
  constructor(
    private readonly registerWebhookUseCase: RegisterWebhookUseCase,
    private readonly listWebhooksUseCase: ListWebhooksUseCase,
    private readonly dispatcherService: OutboxDispatcherService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un nuevo endpoint de Webhook (Solo Administrador - HU-15)',
    description:
      'Registra un endpoint receptor de eventos críticos (transfer.completed) y genera el secreto HMAC-SHA256 para validación de firma.',
  })
  @ApiCreatedResponse({
    description: 'Endpoint registrado exitosamente con su secreto de firma generado.',
  })
  @ApiForbiddenResponse({
    description: 'Acceso denegado: solo administradores pueden configurar webhooks.',
  })
  @ApiNotFoundResponse({
    description: 'Tenant no encontrado.',
  })
  async registerWebhook(
    @Param('slug') slug: string,
    @Body() dto: RegisterWebhookRequestDto,
  ) {
    return this.registerWebhookUseCase.execute({
      tenantSlug: slug,
      url: dto.url,
      events: dto.events,
    });
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Listar endpoints de Webhook configurados para el tenant (HU-15)',
    description: 'Devuelve la lista de endpoints activos sin revelar sus secretos.',
  })
  @ApiOkResponse({
    description: 'Lista de webhooks configurados obtenida exitosamente.',
  })
  async listWebhooks(@Param('slug') slug: string) {
    return this.listWebhooksUseCase.execute(slug);
  }

  @Post('dispatch')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Despachar eventos pendientes del Outbox hacia los webhooks suscritos (HU-15)',
    description:
      'Procesa los eventos pendientes en la tabla outbox_events, envía peticiones HTTP POST con firma criptográfica y gestiona reintentos.',
  })
  async dispatchEvents() {
    return this.dispatcherService.dispatchPending();
  }
}

