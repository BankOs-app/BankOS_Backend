import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, Observable, of } from 'rxjs';
import { mergeMap, tap, catchError } from 'rxjs/operators';
import { IdempotencyService } from '../../application/services/idempotency.service';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';
import { AuthenticatedUser } from '../../../identity/domain/value-objects/authenticated-user.vo';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(
    private readonly reflector: Reflector,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isIdempotent) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const rawKey = request.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    // Criterio CA-HU-10-01: Obligatoriedad de Idempotency-Key
    if (!key) {
      throw new BadRequestException(
        'El encabezado Idempotency-Key es obligatorio para operaciones mutables.',
      );
    }

    if (!IdempotencyInterceptor.UUID_REGEX.test(key.trim())) {
      throw new BadRequestException(
        'El encabezado Idempotency-Key debe ser un UUID v4 válido.',
      );
    }

    const user = request.user as AuthenticatedUser | undefined;
    const userId = user?.userId ?? 'anonymous-user';
    const tenantId = user?.tenantId ?? request.params.slug ?? 'default-tenant';

    const requestHash = this.idempotencyService.computeHash(
      request.body,
      request.path,
      request.method,
    );

    return from(
      this.idempotencyService.acquireLock({
        tenantId,
        userId,
        key: key.trim(),
        requestHash,
      }),
    ).pipe(
      mergeMap((lockResult) => {
        // Criterio CA-HU-10-03: Retornar respuesta original si ya fue completada exitosamente
        if (lockResult.isCached) {
          if (lockResult.responseStatus) {
            response.status(lockResult.responseStatus);
          }
          return of(lockResult.responseBody);
        }

        // Si es una nueva solicitud, ejecutar el caso de uso
        return next.handle().pipe(
          tap((responseData) => {
            void this.idempotencyService.markSucceeded(
              lockResult.record!,
              response.statusCode,
              responseData,
            );
          }),
          catchError((err) => {
            void this.idempotencyService.markFailed(lockResult.record!);
            throw err;
          }),
        );
      }),
    );
  }
}

