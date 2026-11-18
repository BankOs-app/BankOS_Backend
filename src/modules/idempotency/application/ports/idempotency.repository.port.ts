import { IdempotencyRecord } from '../../domain/entities/idempotency-record.entity';

export const IDEMPOTENCY_REPOSITORY = Symbol('IDEMPOTENCY_REPOSITORY');

export interface IdempotencyRepository {
  findByKey(
    tenantId: string,
    userId: string,
    key: string,
  ): Promise<IdempotencyRecord | null>;

  save(record: IdempotencyRecord): Promise<void>;

  update(record: IdempotencyRecord): Promise<void>;
}

