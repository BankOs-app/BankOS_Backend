import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../ports/tenant.repository.port';
import type { TenantRepository } from '../ports/tenant.repository.port';
import { EXCHANGE_RATE_REPOSITORY } from '../ports/exchange-rate.repository.port';
import type { ExchangeRateRepository } from '../ports/exchange-rate.repository.port';
import { ExchangeRate } from '../../domain/entities/exchange-rate.entity';
import { Currency } from '../../domain/value-objects/currency.enum';
import { ExchangeRateResponseDto } from '../dto/exchange-rate-response.dto';
import { RecordAuditLogUseCase } from '../../../audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../audit/domain/value-objects/audit-action.enum';

export interface SetExchangeRateInput {
  slug: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * Caso de Uso: Configurar o Actualizar una Tasa de Cambio Estática (HU-02)
 */
@Injectable()
export class SetExchangeRateUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: ExchangeRateRepository,
    @Optional()
    private readonly recordAuditLogUseCase?: RecordAuditLogUseCase,
  ) {}

  async execute(input: SetExchangeRateInput): Promise<ExchangeRateResponseDto> {
    const tenant = await this.tenantRepository.findBySlug(
      input.slug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant con slug '${input.slug}'`);
    }

    let exchangeRate: ExchangeRate;
    try {
      exchangeRate = ExchangeRate.create({
        tenantId: tenant.getId(),
        fromCurrency: input.fromCurrency,
        toCurrency: input.toCurrency,
        rate: input.rate,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Tasa de cambio inválida';
      throw new BadRequestException(message);
    }

    await this.exchangeRateRepository.saveOrUpdate(exchangeRate);

    if (this.recordAuditLogUseCase) {
      await this.recordAuditLogUseCase
        .execute({
          tenantId: tenant.getId(),
          actorId: input.actorId || 'admin',
          action: AuditAction.SET_EXCHANGE_RATE,
          resource: 'exchange_rates',
          resourceId: `${input.fromCurrency}_${input.toCurrency}`,
          newValues: {
            fromCurrency: input.fromCurrency,
            toCurrency: input.toCurrency,
            rate: input.rate,
          },
          correlationId: input.correlationId,
        })
        .catch(() => {});
    }

    return ExchangeRateResponseDto.fromDomain(exchangeRate);
  }
}

