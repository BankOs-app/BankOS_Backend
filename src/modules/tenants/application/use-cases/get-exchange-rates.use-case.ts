import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../ports/tenant.repository.port';
import type { TenantRepository } from '../ports/tenant.repository.port';
import { EXCHANGE_RATE_REPOSITORY } from '../ports/exchange-rate.repository.port';
import type { ExchangeRateRepository } from '../ports/exchange-rate.repository.port';
import { Currency } from '../../domain/value-objects/currency.enum';
import { ExchangeRateResponseDto } from '../dto/exchange-rate-response.dto';

/**
 * Caso de Uso: Listar Tasas de Cambio o Consultar un Par Específico (HU-02)
 */
@Injectable()
export class GetExchangeRatesUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: ExchangeRateRepository,
  ) {}

  async listAll(slug: string): Promise<ExchangeRateResponseDto[]> {
    const tenant = await this.tenantRepository.findBySlug(
      slug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant con slug '${slug}'`);
    }

    const rates = await this.exchangeRateRepository.listByTenantId(
      tenant.getId(),
    );
    return rates.map((r) => ExchangeRateResponseDto.fromDomain(r));
  }

  async findPair(
    slug: string,
    from: string,
    to: string,
  ): Promise<ExchangeRateResponseDto> {
    const tenant = await this.tenantRepository.findBySlug(
      slug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant con slug '${slug}'`);
    }

    const fromUpper = from.toUpperCase() as Currency;
    const toUpper = to.toUpperCase() as Currency;

    if (
      !Object.values(Currency).includes(fromUpper) ||
      !Object.values(Currency).includes(toUpper)
    ) {
      throw new BadRequestException('Par de monedas no soportado.');
    }

    const rate = await this.exchangeRateRepository.findRate(
      tenant.getId(),
      fromUpper,
      toUpper,
    );

    if (!rate) {
      throw new NotFoundException(
        `No se ha configurado una tasa de cambio entre ${fromUpper} y ${toUpper} para este tenant.`,
      );
    }

    return ExchangeRateResponseDto.fromDomain(rate);
  }
}

