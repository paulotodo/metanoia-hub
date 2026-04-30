import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS, getLimit } from '../plan-limits.config';

describe('plan limits config', () => {
  it.each([
    ['free', 'groups', 3],
    ['free', 'leadersPerTenant', 5],
    ['pro', 'groups', 25],
    ['pro', 'membersPerGroup', 100],
  ] as const)('plan %s resource %s = %i', (plan, resource, expected) => {
    expect(getLimit(plan, resource)).toBe(expected);
  });

  it('enterprise removes the cap (Infinity)', () => {
    expect(PLAN_LIMITS.enterprise.groups).toBe(Infinity);
    expect(PLAN_LIMITS.enterprise.membersPerGroup).toBe(Infinity);
    expect(PLAN_LIMITS.enterprise.leadersPerTenant).toBe(Infinity);
  });
});
