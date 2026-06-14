import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  PlanLimitsSchema,
  PlanLimitsOverrideSchema,
  PlanLimitsOverrideInputSchema,
  SubscriptionPlanSchema,
} from '../plans/subscription';

// ─── PlanLimitsSchema ─────────────────────────────────────────────────────────

describe('PlanLimitsSchema', () => {
  it('snapshot', () => {
    expect(PlanLimitsSchema).toMatchSnapshot();
  });

  it('accepts positive values', () => {
    const result = PlanLimitsSchema.safeParse({
      maxGroups: 3,
      maxMembersPerGroup: 30,
      maxLeadersPerTenant: 5,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null values (unlimited/use-default)', () => {
    const result = PlanLimitsSchema.parse({
      maxGroups: null,
      maxMembersPerGroup: 30,
      maxLeadersPerTenant: 5,
    });
    expect(result).toEqual({
      maxGroups: null,
      maxMembersPerGroup: 30,
      maxLeadersPerTenant: 5,
    });
  });

  it('rejects negative values', () => {
    const result = PlanLimitsSchema.safeParse({
      maxGroups: -1,
      maxMembersPerGroup: 30,
      maxLeadersPerTenant: 5,
    });
    expect(result.success).toBe(false);
  });
});

// ─── PlanLimitsOverrideSchema ─────────────────────────────────────────────────

describe('PlanLimitsOverrideSchema', () => {
  it('snapshot', () => {
    expect(PlanLimitsOverrideSchema).toMatchSnapshot();
  });

  it('accepts empty object (no overrides)', () => {
    const result = PlanLimitsOverrideSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial override', () => {
    const result = PlanLimitsOverrideSchema.safeParse({ maxGroups: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxGroups).toBe(10);
    }
  });
});

// ─── PlanLimitsOverrideInputSchema ────────────────────────────────────────────

describe('PlanLimitsOverrideInputSchema', () => {
  it('snapshot', () => {
    expect(PlanLimitsOverrideInputSchema).toMatchSnapshot();
  });

  it('rejects negative maxGroups', () => {
    expect(() => PlanLimitsOverrideInputSchema.parse({ maxGroups: -1 })).toThrow(ZodError);
  });

  it('rejects zero maxGroups', () => {
    expect(PlanLimitsOverrideInputSchema.safeParse({ maxGroups: 0 }).success).toBe(false);
  });

  it('accepts empty object (US5 AC#3 — zera override)', () => {
    expect(() => PlanLimitsOverrideInputSchema.parse({})).not.toThrow();
    const result = PlanLimitsOverrideInputSchema.parse({});
    expect(result).toEqual({});
  });

  it('accepts valid positive values', () => {
    const result = PlanLimitsOverrideInputSchema.parse({
      maxGroups: 10,
      maxMembersPerGroup: 50,
    });
    expect(result).toEqual({ maxGroups: 10, maxMembersPerGroup: 50 });
  });

  it('rejects float values (must be integer)', () => {
    expect(PlanLimitsOverrideInputSchema.safeParse({ maxGroups: 3.5 }).success).toBe(false);
  });
});

// ─── SubscriptionPlanSchema ───────────────────────────────────────────────────

describe('SubscriptionPlanSchema', () => {
  it('snapshot', () => {
    expect(SubscriptionPlanSchema).toMatchSnapshot();
  });

  const validPlan = {
    id: '019078ab-0000-7000-8000-000000000001',
    name: 'Free',
    tier: 'free' as const,
    limits: { maxGroups: 3, maxMembersPerGroup: 30, maxLeadersPerTenant: 5 },
    features: {},
    metadata: { priceBRL: 0 },
    isActive: true,
    createdAt: '2026-06-14T00:00:00Z',
    updatedAt: '2026-06-14T00:00:00Z',
  };

  it('accepts valid plan without tenantCount', () => {
    expect(SubscriptionPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it('accepts plan with tenantCount (list response)', () => {
    expect(SubscriptionPlanSchema.safeParse({ ...validPlan, tenantCount: 42 }).success).toBe(true);
  });

  it('accepts enterprise tier with null limits', () => {
    const enterprise = {
      ...validPlan,
      tier: 'enterprise' as const,
      limits: { maxGroups: null, maxMembersPerGroup: null, maxLeadersPerTenant: null },
    };
    expect(SubscriptionPlanSchema.safeParse(enterprise).success).toBe(true);
  });

  it('rejects unknown tier', () => {
    expect(SubscriptionPlanSchema.safeParse({ ...validPlan, tier: 'ultra' }).success).toBe(false);
  });
});
