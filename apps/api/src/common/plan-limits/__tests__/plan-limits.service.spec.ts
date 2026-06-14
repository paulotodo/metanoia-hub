import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanLimitsService } from '../plan-limits.service';
import { PLAN_LIMITS_FALLBACK } from '../plan-limits.config';

const TENANT = '01912345-6789-7000-8000-000000000001';

/** Builds a mock PrismaService with configurable tx response */
function makePrisma(
  plan: string,
  groupCount: number,
  options?: {
    planLimitsOverride?: Record<string, number | null> | null;
    subscriptionPlanLimits?: Record<string, number | null> | null;
    subscriptionPlanFound?: boolean;
  },
) {
  const planLimitsOverride = options?.planLimitsOverride ?? null;
  const subscriptionPlanFound = options?.subscriptionPlanFound ?? true;
  const subscriptionPlanLimits = options?.subscriptionPlanLimits ?? {
    maxGroups: plan === 'free' ? 3 : plan === 'pro' ? 25 : null,
    maxMembersPerGroup: plan === 'free' ? 30 : plan === 'pro' ? 100 : null,
    maxLeadersPerTenant: plan === 'free' ? 5 : plan === 'pro' ? 50 : null,
  };

  const tx = {
    tenant: { findUnique: vi.fn().mockResolvedValue(plan === null ? null : { plan }) },
    group: { count: vi.fn().mockResolvedValue(groupCount) },
    userTenant: { count: vi.fn().mockResolvedValue(0) },
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  };

  return {
    client: {
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
      tenant: {
        findUnique: vi.fn().mockResolvedValue(plan === null ? null : { plan, planLimitsOverride }),
        findUniqueOrThrow: plan === null
          ? vi.fn().mockRejectedValue(new Error('Not found'))
          : vi.fn().mockResolvedValue({ plan, planLimitsOverride }),
      },
      subscriptionPlan: {
        findFirst: vi.fn().mockResolvedValue(
          subscriptionPlanFound
            ? { id: 'plan-id', tier: plan, limits: subscriptionPlanLimits, isActive: true }
            : null,
        ),
      },
    },
  } as never;
}

/** Builds a mock RedisService */
function makeRedis(cachedValue?: string | null) {
  return {
    get: vi.fn().mockResolvedValue(cachedValue ?? null),
    set: vi.fn().mockResolvedValue('OK'),
    pipeline: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  } as never;
}

// ─── getLimits ────────────────────────────────────────────────────────────────

describe('PlanLimitsService.getLimits', () => {
  it('cache hit: returns cached value without calling Prisma', async () => {
    const cached: import('../plan-limits.service').ResolvedPlanLimits = {
      maxGroups: 99,
      maxMembersPerGroup: 999,
      maxLeadersPerTenant: 99,
    };
    const redis = makeRedis(JSON.stringify(cached));
    const prisma = makePrisma('free', 0);
    const service = new PlanLimitsService(prisma, redis);

    const result = await service.getLimits(TENANT);
    expect(result).toEqual(cached);
    expect(prisma.client.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('cold read + write-through: no cache → DB → redis.set called', async () => {
    const redis = makeRedis(null);
    const prisma = makePrisma('free', 0);
    const service = new PlanLimitsService(prisma, redis);

    const result = await service.getLimits(TENANT);
    expect(result).toEqual({ maxGroups: 3, maxMembersPerGroup: 30, maxLeadersPerTenant: 5 });
    expect(redis.set).toHaveBeenCalledWith(
      `cache:plan-limits:${TENANT}`,
      JSON.stringify(result),
    );
  });

  it('fallback — subscriptionPlan table empty: returns PLAN_LIMITS_FALLBACK + logger.warn', async () => {
    const redis = makeRedis(null);
    const prisma = makePrisma('free', 0, { subscriptionPlanFound: false });
    const service = new PlanLimitsService(prisma, redis);
    const warnSpy = vi.spyOn(service['logger'], 'warn');

    const result = await service.getLimits(TENANT);
    expect(result.maxGroups).toBe(PLAN_LIMITS_FALLBACK.free.groups);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('override partial: free + {maxGroups:10} → maxGroups=10, rest unchanged', async () => {
    const redis = makeRedis(null);
    const prisma = makePrisma('free', 0, { planLimitsOverride: { maxGroups: 10 } });
    const service = new PlanLimitsService(prisma, redis);

    const result = await service.getLimits(TENANT);
    expect(result).toEqual({ maxGroups: 10, maxMembersPerGroup: 30, maxLeadersPerTenant: 5 });
  });

  it('override field null: free + {maxGroups:null} override → use plan default (3)', async () => {
    const redis = makeRedis(null);
    // override.maxGroups = null means "use default from plan"
    // The ?? operator in service picks planLimits value (3), toLimit(3, 3) = 3
    const prisma = makePrisma('free', 0, { planLimitsOverride: { maxGroups: null } });
    const service = new PlanLimitsService(prisma, redis);

    const result = await service.getLimits(TENANT);
    expect(result.maxGroups).toBe(3);
  });

  it('enterprise null → Infinity (C3)', async () => {
    const redis = makeRedis(null);
    const prisma = makePrisma('enterprise', 0, {
      subscriptionPlanLimits: { maxGroups: null, maxMembersPerGroup: null, maxLeadersPerTenant: null },
    });
    const service = new PlanLimitsService(prisma, redis);

    const result = await service.getLimits(TENANT);
    expect(result.maxGroups).toBe(Infinity);
    expect(result.maxMembersPerGroup).toBe(Infinity);
    expect(result.maxLeadersPerTenant).toBe(Infinity);
  });

  it('paridade contratual (US3 AC#1): free without override = PLAN_LIMITS_FALLBACK.free', async () => {
    const redis = makeRedis(null);
    const prisma = makePrisma('free', 0);
    const service = new PlanLimitsService(prisma, redis);

    const result = await service.getLimits(TENANT);
    expect(result).toEqual({
      maxGroups: PLAN_LIMITS_FALLBACK.free.groups,
      maxMembersPerGroup: PLAN_LIMITS_FALLBACK.free.membersPerGroup,
      maxLeadersPerTenant: PLAN_LIMITS_FALLBACK.free.leadersPerTenant,
    });
  });

  it('DB error → fallback + no 500', async () => {
    const redis = makeRedis(null);
    const prisma = {
      client: {
        tenant: {
          findUniqueOrThrow: vi.fn().mockRejectedValue(new Error('DB down')),
          findUnique: vi.fn().mockResolvedValue({ plan: 'free' }),
        },
        subscriptionPlan: { findFirst: vi.fn() },
      },
    } as never;
    const service = new PlanLimitsService(prisma, redis);

    await expect(service.getLimits(TENANT)).resolves.not.toThrow();
    const result = await service.getLimits(TENANT);
    expect(result.maxGroups).toBe(PLAN_LIMITS_FALLBACK.free.groups);
  });
});

// ─── hasCapacity ─────────────────────────────────────────────────────────────

describe('PlanLimitsService.hasCapacity', () => {
  let service: PlanLimitsService;

  beforeEach(() => {
    service = new PlanLimitsService(makePrisma('free', 1), makeRedis(null));
  });

  it('membersPerGroup not regressed: always allowed (US3 AC#4)', async () => {
    const result = await service.hasCapacity(TENANT, 'membersPerGroup');
    expect(result.allowed).toBe(true);
  });

  it('allows free tenant under groups cap', async () => {
    const s = new PlanLimitsService(makePrisma('free', 2), makeRedis(null));
    const result = await s.hasCapacity(TENANT, 'groups');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(2);
  });

  it('blocks free tenant at groups cap', async () => {
    const s = new PlanLimitsService(makePrisma('free', 3), makeRedis(null));
    const result = await s.hasCapacity(TENANT, 'groups');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(3);
  });

  it('enterprise always allows (Infinity cap)', async () => {
    const s = new PlanLimitsService(
      makePrisma('enterprise', 999, {
        subscriptionPlanLimits: { maxGroups: null, maxMembersPerGroup: null, maxLeadersPerTenant: null },
      }),
      makeRedis(null),
    );
    const result = await s.hasCapacity(TENANT, 'groups');
    expect(result.allowed).toBe(true);
  });
});

// ─── getPlan ─────────────────────────────────────────────────────────────────

describe('PlanLimitsService.getPlan', () => {
  it('returns tenant plan', async () => {
    const service = new PlanLimitsService(makePrisma('pro', 0), makeRedis());
    expect(await service.getPlan(TENANT)).toBe('pro');
  });

  it('defaults to free when tenant not found', async () => {
    const service = new PlanLimitsService(makePrisma(null as unknown as string, 0), makeRedis());
    expect(await service.getPlan(TENANT)).toBe('free');
  });
});
