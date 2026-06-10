import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RadarDashboardService } from './radar-dashboard.service';
import { RadarDashboardRepository } from './radar-dashboard.repository';
import { RedisService } from '../../redis/redis.service';
import { requestContext } from '../../common/context/request-context';
import { RADAR_AGGREGATE_CACHE_KEY_PREFIX } from '@metanoia/types';

// ---- Fixtures ---------------------------------------------------------------

const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const USER_A_ID = '01912345-6789-7000-8000-000000001aa1';
const USER_B_ID = '01912345-6789-7000-8000-000000001bb1';

const GROUP_ROWS_ADMIN = [
  { groupId: 'g1', groupName: 'Alpha', verde: 5, amarelo: 2, vermelho: 1, total: 8 },
  { groupId: 'g2', groupName: 'Beta', verde: 0, amarelo: 3, vermelho: 4, total: 7 },
];

const GROUP_ROWS_LIDER_A = [
  { groupId: 'g1', groupName: 'Alpha', verde: 5, amarelo: 2, vermelho: 1, total: 8 },
];

// ---- Helpers ----------------------------------------------------------------

function runInContext(
  tenantId: string,
  userId: string,
  fn: () => Promise<unknown>,
) {
  return requestContext.run(
    { tenantId, userId, requestId: 'req-1', correlationId: 'cor-1' },
    fn,
  );
}

// ---- Tests ------------------------------------------------------------------

describe('RadarDashboardService', () => {
  let service: RadarDashboardService;
  let repository: { aggregateByTenant: ReturnType<typeof vi.fn>; aggregateByLeader: ReturnType<typeof vi.fn> };
  let redis: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = {
      aggregateByTenant: vi.fn().mockResolvedValue(GROUP_ROWS_ADMIN),
      aggregateByLeader: vi.fn().mockResolvedValue(GROUP_ROWS_LIDER_A),
    };
    redis = {
      get: vi.fn().mockResolvedValue(null), // cache miss by default
      set: vi.fn().mockResolvedValue('OK'),
    };

    service = new RadarDashboardService(
      repository as unknown as RadarDashboardRepository,
      redis as unknown as RedisService,
    );
  });

  // -------------------------------------------------------------------------
  // AC#3 — cache hit: Redis is used and repository NOT called
  // -------------------------------------------------------------------------

  it('AC#3: returns cached result without hitting repository (cache hit)', async () => {
    const cached = JSON.stringify({
      distribution: { verde: 5, amarelo: 2, vermelho: 1, total: 8 },
      byGroup: GROUP_ROWS_LIDER_A,
      trend: 'melhora',
      calculatedAt: '2026-06-10T12:00:00.000Z',
    });
    redis.get.mockResolvedValueOnce(cached);

    const result = await runInContext(TENANT_ID, USER_A_ID, () =>
      service.getDashboard(false),
    );

    expect(redis.get).toHaveBeenCalledOnce();
    expect(repository.aggregateByTenant).not.toHaveBeenCalled();
    expect(result.data.distribution.verde).toBe(5);
    expect(result.meta?.cachedAt).toBe('2026-06-10T12:00:00.000Z');
  });

  it('on cache miss: calls repository and writes to Redis', async () => {
    await runInContext(TENANT_ID, USER_A_ID, () => service.getDashboard(false));

    expect(repository.aggregateByTenant).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledOnce();
    const [key, , , ttl] = redis.set.mock.calls[0] as [string, string, string, number];
    expect(key).toContain(RADAR_AGGREGATE_CACHE_KEY_PREFIX);
    expect(ttl).toBe(30);
  });

  // -------------------------------------------------------------------------
  // AC#2 — lider isolation: only aggregateByLeader is called, with userId
  // -------------------------------------------------------------------------

  it('AC#2: lider=true calls aggregateByLeader with userId from context', async () => {
    await runInContext(TENANT_ID, USER_A_ID, () => service.getDashboard(true));

    expect(repository.aggregateByLeader).toHaveBeenCalledWith(USER_A_ID);
    expect(repository.aggregateByTenant).not.toHaveBeenCalled();
  });

  it('AC#2: admin calls aggregateByTenant — not the leader-filtered variant', async () => {
    await runInContext(TENANT_ID, USER_A_ID, () => service.getDashboard(false));

    expect(repository.aggregateByTenant).toHaveBeenCalledOnce();
    expect(repository.aggregateByLeader).not.toHaveBeenCalled();
  });

  it('AC#2: two different liders get separate cache keys', async () => {
    await runInContext(TENANT_ID, USER_A_ID, () => service.getDashboard(true));
    const keyA = (redis.set.mock.calls[0] as [string, ...unknown[]])[0];

    vi.clearAllMocks();
    redis.get.mockResolvedValue(null);

    await runInContext(TENANT_ID, USER_B_ID, () => service.getDashboard(true));
    const keyB = (redis.set.mock.calls[0] as [string, ...unknown[]])[0];

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain(USER_A_ID);
    expect(keyB).toContain(USER_B_ID);
  });

  // -------------------------------------------------------------------------
  // Trend computation
  // -------------------------------------------------------------------------

  it('derives trend "piora" when vermelho ratio > 40%', async () => {
    repository.aggregateByTenant.mockResolvedValueOnce([
      { groupId: 'g1', groupName: 'Alpha', verde: 1, amarelo: 1, vermelho: 8, total: 10 },
    ]);
    const result = await runInContext(TENANT_ID, USER_A_ID, () =>
      service.getDashboard(false),
    );
    expect(result.data.trend).toBe('piora');
  });

  it('derives trend "melhora" when verde ratio > 60%', async () => {
    repository.aggregateByTenant.mockResolvedValueOnce([
      { groupId: 'g1', groupName: 'Alpha', verde: 7, amarelo: 2, vermelho: 1, total: 10 },
    ]);
    const result = await runInContext(TENANT_ID, USER_A_ID, () =>
      service.getDashboard(false),
    );
    expect(result.data.trend).toBe('melhora');
  });

  it('derives trend "estavel" in the middle range', async () => {
    repository.aggregateByTenant.mockResolvedValueOnce([
      { groupId: 'g1', groupName: 'Alpha', verde: 5, amarelo: 2, vermelho: 3, total: 10 },
    ]);
    const result = await runInContext(TENANT_ID, USER_A_ID, () =>
      service.getDashboard(false),
    );
    expect(result.data.trend).toBe('estavel');
  });

  it('returns "estavel" for empty tenant (no participants)', async () => {
    repository.aggregateByTenant.mockResolvedValueOnce([]);
    const result = await runInContext(TENANT_ID, USER_A_ID, () =>
      service.getDashboard(false),
    );
    expect(result.data.trend).toBe('estavel');
    expect(result.data.distribution.total).toBe(0);
  });
});
