import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanLimitsService } from '../plan-limits.service';

const TENANT = '01912345-6789-7000-8000-000000000001';

function makePrisma(plan: string, groupCount: number) {
  return {
    client: {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ plan }),
      },
      group: {
        count: vi.fn().mockResolvedValue(groupCount),
      },
      userTenant: {
        count: vi.fn().mockResolvedValue(0),
      },
    },
  } as never;
}

describe('PlanLimitsService', () => {
  let service: PlanLimitsService;

  beforeEach(() => {
    service = new PlanLimitsService(makePrisma('free', 1));
  });

  it('getPlan returns the tenant plan', async () => {
    expect(await service.getPlan(TENANT)).toBe('free');
  });

  it('getPlan defaults to free when tenant not found', async () => {
    const s = new PlanLimitsService({
      client: {
        tenant: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    } as never);
    expect(await s.getPlan(TENANT)).toBe('free');
  });

  it('hasCapacity allows free tenant under groups cap', async () => {
    const s = new PlanLimitsService(makePrisma('free', 2));
    const result = await s.hasCapacity(TENANT, 'groups');
    expect(result).toEqual({
      allowed: true,
      current: 2,
      limit: 3,
      plan: 'free',
    });
  });

  it('hasCapacity blocks free tenant at groups cap', async () => {
    const s = new PlanLimitsService(makePrisma('free', 3));
    const result = await s.hasCapacity(TENANT, 'groups');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(3);
    expect(result.limit).toBe(3);
  });

  it('hasCapacity allows enterprise unlimited groups', async () => {
    const s = new PlanLimitsService(makePrisma('enterprise', 999));
    const result = await s.hasCapacity(TENANT, 'groups');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Infinity);
  });

  it('hasCapacity short-circuits membersPerGroup (caller-enforced)', async () => {
    const s = new PlanLimitsService(makePrisma('free', 100));
    const result = await s.hasCapacity(TENANT, 'membersPerGroup');
    expect(result.allowed).toBe(true); // tenant-wide guard says ok
    expect(result.limit).toBe(30); // free cap exposed for caller
  });
});
