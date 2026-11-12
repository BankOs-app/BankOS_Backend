import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'isIdempotent';

/**
 * Decorador para marcar endpoints mutables (depósitos, retiros, transferencias)
 * que requieren obligatoriamente Idempotency-Key.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

