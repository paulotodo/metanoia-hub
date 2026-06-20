import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BullMqService } from '../bullmq/bullmq.service';
import type {
  PlatformMetricsSummary,
  PlatformMetricsTenantRow,
  PlatformMetricsTenantListMeta,
  PlatformTenantsQuery,
} from '@metanoia/types';
import { REPORTS_QUEUE_NAME } from '@metanoia/types';

const SUMMARY_CACHE_KEY = 'cache:platform-metrics:summary';
const SUMMARY_CACHE_TTL = 60; // seconds

// Column map: sortBy field -> MV column name (SEC-02: anti-injection whitelist)
const SORT_COLUMN_MAP: Record<string, string> = {
  tenantName: 'tenant_name',
  totalUsers: 'total_users',
  activeUsers: 'active_users',
  totalGroups: 'total_groups',
  meetingsHeld: 'meetings_held',
  storageBytesUsed: 'storage_bytes_used',
  tenantCreatedAt: 'tenant_created_at',
};

@Injectable()
export class PlatformMetricsService {
  private readonly logger = new Logger(PlatformMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly bullMqService: BullMqService,
  ) {}

  /**
   * FR67-04: Retorna agregados globais de plataforma.
   * Cache Redis com TTL de 60s para evitar leitura excessiva da MV.
   */
  async getSummary(): Promise<{
    data: PlatformMetricsSummary;
    meta: { generatedAt: string; cacheTTL: number };
  }> {
    const client = this.redis;
    const cached = await client.get(SUMMARY_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as {
        data: PlatformMetricsSummary;
        meta: { generatedAt: string; cacheTTL: number };
      };
    }

    // Query cross-tenant da MV (sem filtro de tenant — super-admin only)
    const rows = await this.prisma.client.$queryRaw<
      Array<{
        tenant_id: string;
        total_users: bigint;
        active_users: bigint;
        active_current_month: boolean;
        active_prev_month: boolean;
        total_groups: bigint;
        meetings_held: bigint;
        storage_bytes_used: bigint;
        tenant_created_at: Date;
      }>
    >`SELECT tenant_id, total_users, active_users, active_current_month, active_prev_month,
             total_groups, meetings_held, storage_bytes_used, tenant_created_at
      FROM mv_platform_metrics`;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalUsers = BigInt(0);
    let activeUsers = BigInt(0);
    let totalGroups = BigInt(0);
    let meetingsHeld = BigInt(0);
    let storageBytesUsed = BigInt(0);
    let churnedTenants = 0;
    let newTenants = 0;

    for (const row of rows) {
      totalUsers += row.total_users;
      activeUsers += row.active_users;
      totalGroups += row.total_groups;
      meetingsHeld += row.meetings_held;
      storageBytesUsed += row.storage_bytes_used;

      if (!row.active_current_month && row.active_prev_month) churnedTenants++;
      if (row.tenant_created_at >= thirtyDaysAgo) newTenants++;
    }

    const summary: PlatformMetricsSummary = {
      totalTenants: rows.length,
      totalUsers: Number(totalUsers),
      activeUsers: Number(activeUsers),
      totalGroups: Number(totalGroups),
      meetingsHeld: Number(meetingsHeld),
      storageBytesUsed: storageBytesUsed.toString(),
      churnedTenants,
      newTenants,
      netGrowth: newTenants - churnedTenants,
    };

    const response = {
      data: summary,
      meta: { generatedAt: now.toISOString(), cacheTTL: SUMMARY_CACHE_TTL },
    };

    await client.setex(SUMMARY_CACHE_KEY, SUMMARY_CACHE_TTL, JSON.stringify(response));
    return response;
  }

  /**
   * FR67-05: Retorna lista paginada de tenants com métricas da MV.
   */
  async getTenants(query: PlatformTenantsQuery): Promise<{
    data: PlatformMetricsTenantRow[];
    meta: PlatformMetricsTenantListMeta;
  }> {
    const { page, limit, sortBy, sortOrder, plan, status } = query;
    const offset = (page - 1) * limit;

    // SEC-02: sortCol is from whitelist, not user input
    const sortCol = SORT_COLUMN_MAP[sortBy] ?? 'tenant_name';
    const sortDir = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Build filter clauses
    const filters: string[] = [];
    const params: unknown[] = [];

    if (plan) {
      params.push(plan);
      filters.push(`tenant_plan = $${params.length}`);
    }
    if (status) {
      params.push(status);
      filters.push(`tenant_status = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Raw query with dynamic sort (whitelisted column) — safe from injection
    const rowsQuery = `
      SELECT tenant_id, tenant_name, tenant_plan, tenant_status, tenant_created_at,
             total_users, active_users, active_current_month, active_prev_month,
             total_groups, meetings_held, storage_bytes_used, refreshed_at
      FROM mv_platform_metrics
      ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const countQuery = `SELECT COUNT(*) AS total FROM mv_platform_metrics ${whereClause}`;

    type RawRow = {
      tenant_id: string;
      tenant_name: string;
      tenant_plan: string;
      tenant_status: string;
      tenant_created_at: Date;
      total_users: bigint;
      active_users: bigint;
      active_current_month: boolean;
      active_prev_month: boolean;
      total_groups: bigint;
      meetings_held: bigint;
      storage_bytes_used: bigint;
      refreshed_at: Date;
    };

    // Use $queryRawUnsafe for dynamic query with whitelisted sort column (SEC-02 safe)
    const [rawRows, rawCount] = await Promise.all([
      this.prisma.client.$queryRawUnsafe(rowsQuery, ...params.slice(0, -2), limit, offset),
      this.prisma.client.$queryRawUnsafe(countQuery, ...params.slice(0, filters.length)),
    ]);
    const rows = rawRows as RawRow[];
    const countResult = rawCount as [{ total: bigint }];

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    const data: PlatformMetricsTenantRow[] = rows.map((r: RawRow) => ({
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      tenantPlan: r.tenant_plan,
      tenantStatus: r.tenant_status,
      tenantCreatedAt: r.tenant_created_at.toISOString(),
      totalUsers: Number(r.total_users),
      activeUsers: Number(r.active_users),
      activeCurrentMonth: r.active_current_month,
      activePrevMonth: r.active_prev_month,
      totalGroups: Number(r.total_groups),
      meetingsHeld: Number(r.meetings_held),
      storageBytesUsed: r.storage_bytes_used.toString(),
      refreshedAt: r.refreshed_at.toISOString(),
    }));

    return {
      data,
      meta: { page, limit, total, totalPages, sortBy, sortOrder },
    };
  }

  /**
   * Trigger manual de refresh da mv_platform_metrics (via BullMQ job).
   * Retorna 202 Accepted — o refresh é assíncrono.
   */
  async triggerRefresh(): Promise<{ message: string; jobId: string }> {
    const queue = this.bullMqService.createQueue(REPORTS_QUEUE_NAME);
    const jobId = `manual-platform-refresh-${Date.now()}`;
    await queue.add('refresh-platform-views', {}, { jobId, attempts: 1 });
    this.logger.log({ jobId }, 'manual platform metrics refresh triggered');
    return { message: 'Refresh enfileirado com sucesso', jobId };
  }
}
