import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../tenants/application/ports/tenant.repository.port';
import type { TenantRepository } from '../../../tenants/application/ports/tenant.repository.port';
import { TENANT_SETTINGS_REPOSITORY } from '../../../tenants/application/ports/tenant-settings.repository.port';
import type { TenantSettingsRepository } from '../../../tenants/application/ports/tenant-settings.repository.port';
import { EXCHANGE_RATE_REPOSITORY } from '../../../tenants/application/ports/exchange-rate.repository.port';
import type { ExchangeRateRepository } from '../../../tenants/application/ports/exchange-rate.repository.port';
import { ACCOUNT_REPOSITORY } from '../../../accounts/application/ports/account.repository.port';
import type { AccountRepository } from '../../../accounts/application/ports/account.repository.port';
import { FeeType } from '../../../tenants/domain/value-objects/fee-type.enum';
import { PreviewTransferResponseDto } from '../dto/preview-transfer-response.dto';

export interface PreviewTransferInput {
  tenantSlug: string;
  sourceAccountNumber: string;
  destinationAccountNumber: string;
  targetAmount: string;
}

/**
 * Caso de Uso: Previsualizar Transferencia (HU-09 - T02, CA-HU-09-01, CA-HU-09-02)
 *
 * Simula el cálculo de la transferencia sin realizar movimientos en saldos ni base de datos.
 * Desglosa monto a recibir en destino, conversión de tasa estática, comisión y total a debitar.
 */
@Injectable()
export class PreviewTransferUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    @Inject(TENANT_SETTINGS_REPOSITORY)
    private readonly settingsRepository: TenantSettingsRepository,
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: ExchangeRateRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(input: PreviewTransferInput): Promise<PreviewTransferResponseDto> {
    // 1. Validar existencia del tenant
    const tenant = await this.tenantRepository.findBySlug(
      input.tenantSlug.trim().toLowerCase(),
    );
    if (!tenant) {
      throw new NotFoundException(`No existe el tenant '${input.tenantSlug}'`);
    }

    // 2. Validar cuenta origen en el tenant
    const sourceAccount = await this.accountRepository.findByNumber(
      tenant.getId(),
      input.sourceAccountNumber.trim(),
    );
    if (!sourceAccount) {
      throw new NotFoundException(
        `Cuenta origen '${input.sourceAccountNumber}' no encontrada en esta institución.`,
      );
    }

    // 3. Validar cuenta destino en el tenant (CA-HU-09-03: rechazar cuentas ajenas sin revelar datos)
    const destinationAccount = await this.accountRepository.findByNumber(
      tenant.getId(),
      input.destinationAccountNumber.trim(),
    );
    if (!destinationAccount) {
      throw new NotFoundException(
        `Cuenta destino '${input.destinationAccountNumber}' no encontrada en esta institución.`,
      );
    }

    // 4. Validar estado de ambas cuentas
    if (!sourceAccount.canTransact()) {
      throw new BadRequestException(
        `La cuenta de origen se encuentra en estado '${sourceAccount.getStatus()}'.`,
      );
    }
    if (!destinationAccount.canTransact()) {
      throw new BadRequestException(
        `La cuenta de destino se encuentra en estado '${destinationAccount.getStatus()}'.`,
      );
    }

    // 5. Validar monto estrictamente mayor a 0
    const targetAmountNum = Number(input.targetAmount);
    if (isNaN(targetAmountNum) || targetAmountNum <= 0) {
      throw new BadRequestException(
        'El monto que recibirá el destino debe ser estrictamente positivo y mayor a 0.',
      );
    }

    // 6. Consultar configuración del tenant
    const settings = await this.settingsRepository.findByTenantId(tenant.getId());
    const feeType = settings ? settings.getFeeType() : FeeType.FIXED;
    const feeValue = settings ? Number(settings.getFeeValue()) : 0;

    // 7. Calcular conversión de moneda y tasa
    const sourceCurrency = sourceAccount.getCurrency();
    const destinationCurrency = destinationAccount.getCurrency();

    let sourceEquivalent: number;
    let rateAppliedStr: string;

    if (sourceCurrency === destinationCurrency) {
      sourceEquivalent = targetAmountNum;
      rateAppliedStr = '1.000000';
    } else {
      // Buscar tasa directa (1 source = rate destination)
      const directRate = await this.exchangeRateRepository.findRate(
        tenant.getId(),
        sourceCurrency,
        destinationCurrency,
      );

      if (directRate) {
        const rateNum = Number(directRate.getRate());
        sourceEquivalent = Number((targetAmountNum / rateNum).toFixed(2));
        rateAppliedStr = directRate.getRate();
      } else {
        // Buscar tasa inversa (1 destination = inverseRate source)
        const inverseRate = await this.exchangeRateRepository.findRate(
          tenant.getId(),
          destinationCurrency,
          sourceCurrency,
        );

        if (inverseRate) {
          const rateNum = Number(inverseRate.getRate());
          sourceEquivalent = Number((targetAmountNum * rateNum).toFixed(2));
          rateAppliedStr = inverseRate.getRate();
        } else {
          throw new BadRequestException(
            `No existe una tasa de cambio configurada para el par '${sourceCurrency}' -> '${destinationCurrency}'.`,
          );
        }
      }
    }

    // 8. Calcular comisión adicional en la moneda de origen
    let feeNum = 0;
    if (feeType === FeeType.FIXED) {
      feeNum = feeValue;
    } else {
      feeNum = Number((sourceEquivalent * (feeValue / 100)).toFixed(2));
    }

    const feeAmountStr = feeNum.toFixed(2);
    const sourceEquivalentStr = sourceEquivalent.toFixed(2);
    const totalDebitNum = sourceEquivalent + feeNum;
    const totalDebitStr = totalDebitNum.toFixed(2);

    // 9. Validar límite máximo configurado
    if (settings) {
      const maxLimit = Number(settings.getMaxTransactionAmount());
      if (totalDebitNum > maxLimit) {
        throw new BadRequestException(
          `El total a debitar (${totalDebitStr} ${sourceCurrency}) excede el límite máximo permitido por transacción (${settings.getMaxTransactionAmount()} ${settings.getPrimaryCurrency()}).`,
        );
      }
    }

    // 10. Construir respuesta
    const response = new PreviewTransferResponseDto();
    response.sourceAccountNumber = sourceAccount.getAccountNumber();
    response.sourceCurrency = sourceCurrency;
    response.destinationAccountNumber = destinationAccount.getAccountNumber();
    response.destinationCurrency = destinationCurrency;
    response.targetAmount = Number(input.targetAmount).toFixed(2);
    response.sourceEquivalentAmount = sourceEquivalentStr;
    response.exchangeRateApplied = rateAppliedStr;
    response.feeAmount = feeAmountStr;
    response.feeType = feeType;
    response.totalDebitAmount = totalDebitStr;

    return response;
  }
}

