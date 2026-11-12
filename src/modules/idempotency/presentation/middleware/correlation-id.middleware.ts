import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

/**
 * Middleware de Trazabilidad: X-Correlation-ID (HU-10)
 *
 * - Lee el encabezado X-Correlation-ID recibido de la app móvil o clientes externos.
 * - Si no viene, genera automáticamente un UUID v4.
 * - Lo propaga al contexto de la petición y lo estampa en los encabezados de respuesta HTTP.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelation, res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-correlation-id'];
    const correlationId =
      (Array.isArray(rawHeader) ? rawHeader[0] : rawHeader) || randomUUID();

    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}

