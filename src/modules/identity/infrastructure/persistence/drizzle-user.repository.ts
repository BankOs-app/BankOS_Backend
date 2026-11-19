import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../database/database.module';
import type { DrizzleDb } from '../../../../database/database.module';
import { getTenantTables } from '../../../../database/schema/tenant-tables.factory';
import { TenantSchemaResolver } from '../../../../database/tenant-schema-resolver.service';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/value-objects/user-role.enum';
import { UserStatus } from '../../domain/value-objects/user-status.enum';
import type { UserRepository } from '../../application/ports/user.repository.port';

@Injectable()
export class DrizzleUserRepository implements UserRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly schemaResolver: TenantSchemaResolver,
  ) { }

  async save(user: User): Promise<void> {
    const info = await this.schemaResolver.resolve(user.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db.insert(tables.usersTable).values({
      id: user.getId(),
      email: user.getEmail().trim().toLowerCase(),
      role: user.getRole(),
      status: user.getStatus(),
      passwordHash: user.getPasswordHash(),
      createdAt: user.getCreatedAt(),
      updatedAt: user.getUpdatedAt(),
    });
  }

  async update(user: User): Promise<void> {
    const info = await this.schemaResolver.resolve(user.getTenantId());
    const tables = getTenantTables(info.schemaName);

    await this.db
      .update(tables.usersTable)
      .set({
        role: user.getRole(),
        status: user.getStatus(),
        passwordHash: user.getPasswordHash(),
        updatedAt: user.getUpdatedAt(),
      })
      .where(eq(tables.usersTable.id, user.getId()));
  }

  async findById(id: string, tenantId?: string): Promise<User | null> {
    if (tenantId) {
      const info = await this.schemaResolver.resolve(tenantId);
      const tables = getTenantTables(info.schemaName);
      const rows = await this.db
        .select()
        .from(tables.usersTable)
        .where(eq(tables.usersTable.id, id))
        .limit(1);

      if (rows.length === 0) return null;
      return this.mapToDomain(rows[0], info.tenantId);
    }

    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.usersTable)
        .where(eq(tables.usersTable.id, id))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }

    return null;
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db
      .select()
      .from(tables.usersTable)
      .where(eq(tables.usersTable.email, email.trim().toLowerCase()))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapToDomain(rows[0], info.tenantId);
  }

  async findAnyByEmail(email: string): Promise<User | null> {
    const schemas = await this.schemaResolver.getAllActiveSchemas();
    for (const schema of schemas) {
      const tables = getTenantTables(schema.schemaName);
      const rows = await this.db
        .select()
        .from(tables.usersTable)
        .where(eq(tables.usersTable.email, email.trim().toLowerCase()))
        .limit(1);

      if (rows.length > 0) {
        return this.mapToDomain(rows[0], schema.tenantId);
      }
    }
    return null;
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    const info = await this.schemaResolver.resolve(tenantId);
    const tables = getTenantTables(info.schemaName);

    const rows = await this.db.select().from(tables.usersTable);
    return rows.map((r) => this.mapToDomain(r, info.tenantId));
  }

  private mapToDomain(row: any, tenantId: string): User {
    return User.reconstitute({
      id: row.id,
      tenantId,
      email: row.email,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      passwordHash: row.passwordHash ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
