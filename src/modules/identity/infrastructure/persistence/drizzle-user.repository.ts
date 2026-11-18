import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { usersTable, UserRecord } from '../../../../database/schema/users-customers.schema';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/value-objects/user-role.enum';
import { UserStatus } from '../../domain/value-objects/user-status.enum';
import type { UserRepository } from '../../application/ports/user.repository.port';

@Injectable()
export class DrizzleUserRepository implements UserRepository, OnModuleInit {
  private readonly logger = new Logger(DrizzleUserRepository.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
          email VARCHAR(150) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'customer',
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT users_tenant_email_unique UNIQUE(tenant_id, email)
        );
      `);
      this.logger.log('Tabla public.users verificada o inicializada.');
    } catch {
      this.logger.warn('No se pudo verificar la tabla public.users en el arranque.');
    }
  }

  async save(user: User): Promise<void> {
    await this.db.insert(usersTable).values({
      id: user.getId(),
      tenantId: user.getTenantId(),
      email: user.getEmail(),
      role: user.getRole(),
      status: user.getStatus(),
      createdAt: user.getCreatedAt(),
      updatedAt: user.getUpdatedAt(),
    });
  }

  async update(user: User): Promise<void> {
    await this.db
      .update(usersTable)
      .set({
        role: user.getRole(),
        status: user.getStatus(),
        updatedAt: user.getUpdatedAt(),
      })
      .where(eq(usersTable.id, user.getId()));
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.tenantId, tenantId),
          eq(usersTable.email, email.trim().toLowerCase()),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0]);
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: UserRecord): User {
    return User.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      email: row.email,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

