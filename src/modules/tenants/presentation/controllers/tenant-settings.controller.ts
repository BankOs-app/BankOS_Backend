import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GetTenantSettingsUseCase } from '../../application/use-cases/get-tenant-settings.use-case';
import { UpdateTenantSettingsUseCase } from '../../application/use-cases/update-tenant-settings.use-case';
import { SetExchangeRateUseCase } from '../../application/use-cases/set-exchange-rate.use-case';
import { GetExchangeRatesUseCase } from '../../application/use-cases/get-exchange-rates.use-case';
import { UpdateTenantSettingsRequestDto } from '../dto/update-tenant-settings.request.dto';
import { SetExchangeRateRequestDto } from '../dto/set-exchange-rate.request.dto';
import { TenantSettingsResponseDto } from '../../application/dto/tenant-settings-response.dto';
import { ExchangeRateResponseDto } from '../../application/dto/exchange-rate-response.dto';

@ApiTags('Tenant Settings & Exchange Rates (HU-02)')
@Controller('tenants/:slug')
export class TenantSettingsController {
  constructor(
    private readonly getTenantSettingsUseCase: GetTenantSettingsUseCase,
    private readonly updateTenantSettingsUseCase: UpdateTenantSettingsUseCase,
    private readonly setExchangeRateUseCase: SetExchangeRateUseCase,
    private readonly getExchangeRatesUseCase: GetExchangeRatesUseCase,
  ) {}

  @Get('settings')
  @ApiOperation({
    summary: 'Consultar configuración financiera de un tenant',
    description:
      'Devuelve la moneda principal, límite máximo por transacción y configuración de comisiones.',
  })
  @ApiOkResponse({ type: TenantSettingsResponseDto })
  @ApiNotFoundResponse({ description: 'Tenant no encontrado.' })
  async getSettings(
    @Param('slug') slug: string,
  ): Promise<TenantSettingsResponseDto> {
    return this.getTenantSettingsUseCase.execute(slug);
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Actualizar configuración financiera de un tenant',
    description:
      'Permite modificar la moneda principal, límite por transacción y comisión fija o porcentual.',
  })
  @ApiOkResponse({ type: TenantSettingsResponseDto })
  @ApiBadRequestResponse({
    description: 'Parámetros inválidos (ej. comisión porcentual fuera de [0, 100]).',
  })
  @ApiNotFoundResponse({ description: 'Tenant no encontrado.' })
  async updateSettings(
    @Param('slug') slug: string,
    @Body() dto: UpdateTenantSettingsRequestDto,
  ): Promise<TenantSettingsResponseDto> {
    return this.updateTenantSettingsUseCase.execute({
      slug,
      primaryCurrency: dto.primaryCurrency,
      maxTransactionAmount: dto.maxTransactionAmount,
      feeType: dto.feeType,
      feeValue: dto.feeValue,
    });
  }

  @Get('exchange-rates')
  @ApiOperation({
    summary: 'Listar todas las tasas de cambio configuradas para el tenant',
  })
  @ApiOkResponse({ type: [ExchangeRateResponseDto] })
  async listExchangeRates(
    @Param('slug') slug: string,
  ): Promise<ExchangeRateResponseDto[]> {
    return this.getExchangeRatesUseCase.listAll(slug);
  }

  @Get('exchange-rates/:from/:to')
  @ApiOperation({
    summary: 'Consultar la tasa de cambio específica para un par de divisas',
  })
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @ApiNotFoundResponse({
    description: 'No existe tasa configurada para ese par en el tenant.',
  })
  async getExchangeRate(
    @Param('slug') slug: string,
    @Param('from') from: string,
    @Param('to') to: string,
  ): Promise<ExchangeRateResponseDto> {
    return this.getExchangeRatesUseCase.findPair(slug, from, to);
  }

  @Post('exchange-rates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar o actualizar la tasa de cambio estática entre dos divisas',
    description:
      'La tasa debe ser estrictamente mayor a 0 y no se permite par idéntico.',
  })
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @ApiBadRequestResponse({
    description: 'Tasa no positiva o par inválido.',
  })
  async setExchangeRate(
    @Param('slug') slug: string,
    @Body() dto: SetExchangeRateRequestDto,
  ): Promise<ExchangeRateResponseDto> {
    return this.setExchangeRateUseCase.execute({
      slug,
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      rate: dto.rate,
    });
  }
}

