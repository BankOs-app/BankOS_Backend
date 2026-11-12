import { OutboxEvent } from '../../domain/entities/outbox-event.entity';

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export interface OutboxRepository {
  save(event: OutboxEvent): Promise<void>;
  update(event: OutboxEvent): Promise<void>;
  findById(id: string): Promise<OutboxEvent | null>;
  findPendingEvents(limit?: number): Promise<OutboxEvent[]>;
  findByTenantId(tenantId: string): Promise<OutboxEvent[]>;
}

