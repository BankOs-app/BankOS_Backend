import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.tokens';

export interface TenantSchemaInfo {
  schemaName: string;
  tenantId: string;
  slug?: string;
}

@Injectable()
export class TenantSchemaResolver {
  private readonly logger = new Logger(TenantSchemaResolver.name);
  private readonly schemaCache = new Map<string, TenantSchemaInfo>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Resuelve el nombre del esquema PostgreSQL y el ID del tenant
   * a partir del UUID o del slug del tenant.
   */
  async resolve(tenantIdOrSlug: string): Promise<TenantSchemaInfo> {
    if (!tenantIdOrSlug) {
      throw new Error('El identificador del tenant (ID o slug) es requerido.');
    }

    const trimmed = tenantIdOrSlug.trim();
    const cached = this.schemaCache.get(trimmed);
    if (cached) {
      return cached;
    }

    // Si ya viene con prefijo 'tenant_'
    if (trimmed.startsWith('tenant_')) {
      try {
        const res = await this.pool.query(
          `SELECT id, slug, schema_name FROM public.tenants WHERE schema_name = $1 LIMIT 1`,
          [trimmed],
        );
        if (res.rows.length > 0) {
          const info: TenantSchemaInfo = {
            schemaName: res.rows[0].schema_name,
            tenantId: res.rows[0].id,
            slug: res.rows[0].slug,
          };
          this.setCache(info);
          return info;
        }
      } catch (err) {
        this.logger.warn(`Error buscando esquema '${trimmed}': ${String(err)}`);
      }
      return { schemaName: trimmed, tenantId: trimmed };
    }

    try {
      const res = await this.pool.query(
        `SELECT id, slug, schema_name FROM public.tenants WHERE id::text = $1 OR slug = $1 LIMIT 1`,
        [trimmed],
      );
      if (res.rows.length > 0) {
        const info: TenantSchemaInfo = {
          schemaName: res.rows[0].schema_name,
          tenantId: res.rows[0].id,
          slug: res.rows[0].slug,
        };
        this.setCache(info);
        return info;
      }
    } catch (err) {
      this.logger.warn(`Error resolviendo tenant '${trimmed}': ${String(err)}`);
    }

    // Derivación determinista de respaldo
    const safeSlug = trimmed.replace(/-/g, '_').toLowerCase();
    const fallback: TenantSchemaInfo = {
      schemaName: `tenant_${safeSlug}`,
      tenantId: trimmed,
      slug: trimmed,
    };
    this.setCache(fallback);
    return fallback;
  }

  async getSchemaName(tenantIdOrSlug: string): Promise<string> {
    const info = await this.resolve(tenantIdOrSlug);
    return info.schemaName;
  }

  async getTenantId(tenantIdOrSlug: string): Promise<string> {
    const info = await this.resolve(tenantIdOrSlug);
    return info.tenantId;
  }

  async getAllActiveSchemas(): Promise<TenantSchemaInfo[]> {
    try {
      const res = await this.pool.query(
        `SELECT id, slug, schema_name FROM public.tenants WHERE status = 'ACTIVE'`,
      );
      return res.rows.map((r: any) => {
        const info: TenantSchemaInfo = {
          schemaName: r.schema_name,
          tenantId: r.id,
          slug: r.slug,
        };
        this.setCache(info);
        return info;
      });
    } catch {
      return [];
    }
  }

  public registerInCache(info: TenantSchemaInfo): void {
    this.setCache(info);
  }

  private setCache(info: TenantSchemaInfo): void {
    this.schemaCache.set(info.tenantId, info);
    this.schemaCache.set(info.schemaName, info);
    if (info.slug) {
      this.schemaCache.set(info.slug, info);
    }
  }
}
