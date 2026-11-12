import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../identity/presentation/guards/jwt-auth.guard';
import { TenantMatchGuard } from '../../../identity/presentation/guards/tenant-match.guard';
import { CurrentUser } from '../../../identity/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../identity/domain/value-objects/authenticated-user.vo';
import { IdempotencyInterceptor } from '../../../idempotency/presentation/interceptors/idempotency.interceptor';
import { Idempotent } from '../../../idempotency/presentation/decorators/idempotent.decorator';
import { DepositUseCase } from '../../application/use-cases/deposit.use-case';
import { WithdrawUseCase } from '../../application/use-cases/withdraw.use-case';
import { PreviewTransferUseCase } from '../../application/use-cases/preview-transfer.use-case';
import { TransferUseCase } from '../../application/use-cases/transfer.use-case';
import { GetTransactionHistoryUseCase } from '../../application/use-cases/get-transaction-history.use-case';
import { GetTransactionDetailUseCase } from '../../application/use-cases/get-transaction-detail.use-case';
import { DepositRequestDto } from '../dto/deposit.request.dto';
import { DepositResponseDto } from '../../application/dto/deposit-response.dto';
import { WithdrawRequestDto } from '../dto/withdraw.request.dto';
import { WithdrawResponseDto } from '../../application/dto/withdraw-response.dto';
import { PreviewTransferRequestDto } from '../dto/preview-transfer.request.dto';
import { PreviewTransferResponseDto } from '../../application/dto/preview-transfer-response.dto';
import { TransferRequestDto } from '../dto/transfer.request.dto';
import { TransferResponseDto } from '../../application/dto/transfer-response.dto';
import { TransactionQueryDto } from '../dto/transaction-query.dto';
import { PaginatedTransactionsResponseDto } from '../../application/dto/paginated-transactions-response.dto';
import { TransactionDetailResponseDto } from '../../application/dto/transaction-detail-response.dto';

@ApiTags('Operaciones Financieras & Historial (HU-07, HU-08, HU-09, HU-11)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantMatchGuard)
@Controller('tenants/:slug/transactions')
export class TransactionsController {
  constructor(
    private readonly depositUseCase: DepositUseCase,
    private readonly withdrawUseCase: WithdrawUseCase,
    private readonly previewTransferUseCase: PreviewTransferUseCase,
    private readonly transferUseCase: TransferUseCase,
    private readonly getTransactionHistoryUseCase: GetTransactionHistoryUseCase,
    private readonly getTransactionDetailUseCase: GetTransactionDetailUseCase,
  ) {}

  @Post('deposits')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Abonar fondos a una cuenta bancaria activa (HU-07)',
    description:
      'Requiere obligatoriamente el encabezado Idempotency-Key (UUID). Si la solicitud se reintenta, devuelve el resultado original sin duplicar el abono.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID v4 generado en el cliente para garantizar idempotencia',
    required: true,
  })
  @ApiHeader({
    name: 'X-Correlation-ID',
    description: 'UUID para trazabilidad transversal en logs y respuesta',
    required: false,
  })
  @ApiCreatedResponse({
    description: 'Depósito procesado y contabilizado exitosamente.',
    type: DepositResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Monto negativo o cero, cuenta inactiva o límite máximo por transacción excedido.',
  })
  @ApiConflictResponse({
    description:
      'Operación concurrente en curso o Idempotency-Key reutilizada con datos diferentes.',
  })
  @ApiNotFoundResponse({
    description: 'Tenant o cuenta destino no encontrados.',
  })
  async deposit(
    @Param('slug') slug: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: DepositRequestDto,
  ): Promise<DepositResponseDto> {
    return this.depositUseCase.execute({
      tenantSlug: slug,
      accountNumber: dto.accountNumber,
      amount: dto.amount,
      idempotencyKey,
    });
  }

  @Post('withdrawals')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Retirar fondos de una cuenta bancaria activa (HU-08)',
    description:
      'Debita fondos de una cuenta activa con saldo suficiente. Requiere Idempotency-Key (UUID) y X-Correlation-ID. Evita doble gasto.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID v4 generado en el cliente para garantizar idempotencia',
    required: true,
  })
  @ApiHeader({
    name: 'X-Correlation-ID',
    description: 'UUID para trazabilidad transversal en logs y respuesta',
    required: false,
  })
  @ApiCreatedResponse({
    description: 'Retiro procesado y contabilizado exitosamente.',
    type: WithdrawResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Saldo insuficiente, monto negativo o cero, cuenta inactiva o límite excedido.',
  })
  @ApiConflictResponse({
    description:
      'Operación concurrente en curso o Idempotency-Key reutilizada con datos diferentes.',
  })
  @ApiNotFoundResponse({
    description: 'Tenant o cuenta origen no encontrados.',
  })
  async withdraw(
    @Param('slug') slug: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: WithdrawRequestDto,
  ): Promise<WithdrawResponseDto> {
    return this.withdrawUseCase.execute({
      tenantSlug: slug,
      accountNumber: dto.accountNumber,
      amount: dto.amount,
      idempotencyKey,
    });
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Previsualizar transferencia entre cuentas (HU-09 - T03)',
    description:
      'Calcula en tiempo real la tasa de cambio estática, la comisión de la institución y el total que se debitará en la moneda de origen sin afectar saldos.',
  })
  @ApiCreatedResponse({
    description: 'Desglose detallado de la simulación de transferencia.',
    type: PreviewTransferResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Monto inválido, cuentas inactivas, límite excedido o par de divisas sin tasa configurada.',
  })
  @ApiNotFoundResponse({
    description: 'Tenant, cuenta de origen o cuenta de destino no encontrados.',
  })
  async previewTransfer(
    @Param('slug') slug: string,
    @Body() dto: PreviewTransferRequestDto,
  ): Promise<PreviewTransferResponseDto> {
    return this.previewTransferUseCase.execute({
      tenantSlug: slug,
      sourceAccountNumber: dto.sourceAccountNumber,
      destinationAccountNumber: dto.destinationAccountNumber,
      targetAmount: dto.targetAmount,
    });
  }

  @Post('transfers')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ejecutar transferencia interna o multimoneda (HU-09)',
    description:
      'Debita la cuenta origen y acredita la cuenta destino con soporte multimoneda y comisiones. Requiere Idempotency-Key y X-Correlation-ID.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID v4 generado en el cliente para garantizar idempotencia',
    required: true,
  })
  @ApiHeader({
    name: 'X-Correlation-ID',
    description: 'UUID para trazabilidad transversal en logs y respuesta',
    required: false,
  })
  @ApiCreatedResponse({
    description: 'Transferencia completada y registrada en el libro mayor contable (Ledger).',
    type: TransferResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Saldo insuficiente, monto inválido, cuentas inactivas o divisas sin tasa.',
  })
  @ApiConflictResponse({
    description:
      'Operación concurrente en curso o Idempotency-Key reutilizada con datos diferentes.',
  })
  @ApiNotFoundResponse({
    description: 'Tenant, cuenta de origen o cuenta de destino no encontrados.',
  })
  async transfer(
    @Param('slug') slug: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: TransferRequestDto,
  ): Promise<TransferResponseDto> {
    return this.transferUseCase.execute({
      tenantSlug: slug,
      sourceAccountNumber: dto.sourceAccountNumber,
      destinationAccountNumber: dto.destinationAccountNumber,
      targetAmount: dto.targetAmount,
      idempotencyKey,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar historial de transacciones con filtros y paginación (HU-11)',
    description:
      'Si el usuario autenticado tiene rol customer, solo recibe movimientos de sus cuentas. Soporta filtros por tipo, rango de fechas y paginación.',
  })
  @ApiOkResponse({
    description: 'Historial de transacciones paginado obtenido exitosamente.',
    type: PaginatedTransactionsResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Tenant no encontrado o cuenta consultada no pertenece al usuario.',
  })
  async getHistory(
    @Param('slug') slug: string,
    @Query() query: TransactionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedTransactionsResponseDto> {
    return this.getTransactionHistoryUseCase.execute({
      tenantSlug: slug,
      userId: user.userId,
      role: user.role,
      type: query.type,
      startDate: query.startDate,
      endDate: query.endDate,
      accountNumber: query.accountNumber,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar detalle financiero de una transacción específica (HU-11 - T04)',
    description:
      'Devuelve datos completos de la transacción con sus asientos en el libro mayor (Ledger). Valida que el cliente sea titular de alguna de las cuentas involucradas.',
  })
  @ApiOkResponse({
    description: 'Detalle financiero de la transacción y sus asientos de Ledger.',
    type: TransactionDetailResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'Transacción no encontrada o no pertenece a una cuenta autorizada del usuario (CA-HU-11-05).',
  })
  async getDetail(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionDetailResponseDto> {
    return this.getTransactionDetailUseCase.execute({
      tenantSlug: slug,
      transactionId: id,
      userId: user.userId,
      role: user.role,
    });
  }
}
