import { Injectable, Logger } from '@nestjs/common';
import type {
  RadarDashboardResponse,
  RadarGroupSummary,
  RadarStatusDistribution,
  DashboardTrend,
} from '@metanoia/types';
import {
  RADAR_AGGREGATE_CACHE_KEY_PREFIX,
  RADAR_AGGREGATE_CACHE_TTL_SECONDS,
} from '@metanoia/types';
import { getRequestContext } from '../../common/context/request-context';
import { RedisService } from '../../redis/redis.service';
import { RadarDashboardRepository } from './radar-dashboard.repository';

interface CachedAggregate {
  distribution: RadarStatusDistribution;
  byGroup: RadarGroupSummary[];
  trend: DashboardTrend;
  calculatedAt: string;
}

@Injectable()
export class RadarDashboardService {
  private readonly logger = new Logger(RadarDashboardService.name);

  constructor(
    private readonly repository: RadarDashboardRepository,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Returns the aggregated radar dashboard for the calling user.
   * - admin_tenant: all groups in tenant
   * - lider: only groups where userId is 'lider' (server-side privacy guardrail)
   *
   * Results are cached in Redis for RADAR_AGGREGATE_CACHE_TTL_SECONDS (30s).
   * Cache key embeds both tenantId and userId so admin vs leader get separate
   * cache entries, preventing data leakage between roles.
   */
  async getDashboard(isLider: boolean): Promise<RadarDashboardResponse> {
    const ctx = getRequestContext();
    const { tenantId, userId } = ctx;

    // Cache key: scoped to (tenant, user) so lider A never sees lider B's data
    const cacheKey = isLider
      ? `${RADAR_AGGREGATE_CACHE_KEY_PREFIX}:${tenantId}:${userId ?? 'anon'}`
      : `${RADAR_AGGREGATE_CACHE_KEY_PREFIX}:${tenantId}`;

    // Try Redis cache first
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CachedAggregate;
        this.logger.debug({ tenantId, cacheKey }, 'radar dashboard cache hit');
        return {
          data: parsed,
          meta: {
            groupCount: parsed.byGroup.length,
            cachedAt: parsed.calculatedAt,
          },
        };
      } catch {
        // Corrupted cache entry — fall through to DB
        this.logger.warn({ cacheKey }, 'radar dashboard cache parse error, refetching');
      }
    }

    // Compute fresh from DB
    const resolvedUserId = userId ?? 'system';
    const rows = isLider
      ? await this.repository.aggregateByLeader(resolvedUserId)
      : await this.repository.aggregateByTenant();

    const distribution = this.computeDistribution(rows);
    const trend = this.deriveTrend(distribution);
    const calculatedAt = new Date().toISOString();

    const aggregate: CachedAggregate = {
      distribution,
      byGroup: rows,
      trend,
      calculatedAt,
    };

    // Write to Redis cache
    try {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(aggregate),
        'EX',
        RADAR_AGGREGATE_CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn({ cacheKey, err }, 'failed to cache radar dashboard');
    }

    return {
      data: aggregate,
      meta: {
        groupCount: rows.length,
        cachedAt: null,
      },
    };
  }

  private computeDistribution(
    rows: { verde: number; amarelo: number; vermelho: number; total: number }[],
  ): RadarStatusDistribution {
    let verde = 0;
    let amarelo = 0;
    let vermelho = 0;

    for (const r of rows) {
      verde += r.verde;
      amarelo += r.amarelo;
      vermelho += r.vermelho;
    }

    return { verde, amarelo, vermelho, total: verde + amarelo + vermelho };
  }

  private deriveTrend(dist: RadarStatusDistribution): DashboardTrend {
    if (dist.total === 0) return 'estavel';

    const redRatio = dist.vermelho / dist.total;
    const greenRatio = dist.verde / dist.total;

    if (redRatio > 0.4) return 'piora';
    if (greenRatio > 0.6) return 'melhora';
    return 'estavel';
  }
}
