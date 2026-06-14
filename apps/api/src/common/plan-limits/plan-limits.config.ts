import type { TenantPlan } from '@metanoia/types';

/**
 * Story 3-3 — Plan Limits Hardcoded (fallback).
 * Story 11-1 — renamed PLAN_LIMITS → PLAN_LIMITS_FALLBACK.
 *
 * Used as the fallback when the `subscription_plans` table is empty or
 * unreachable. PlanLimitsService.getLimits() prefers the dynamic DB value;
 * it falls back to PLAN_LIMITS_FALLBACK so the service NEVER throws 500.
 *
 * Conventions:
 *  - Number = hard cap. Creating the (cap+1)th resource is rejected with 403.
 *  - `Infinity` = no cap (enterprise tier).
 *
 * Values must stay in sync with the seed canonical values (spec.md §C4).
 */
export const PLAN_LIMITS_FALLBACK = {
  free: {
    groups: 3,
    membersPerGroup: 30,
    leadersPerTenant: 5,
  },
  pro: {
    groups: 25,
    membersPerGroup: 100,
    leadersPerTenant: 50,
  },
  enterprise: {
    groups: Infinity,
    membersPerGroup: Infinity,
    leadersPerTenant: Infinity,
  },
} as const satisfies Record<TenantPlan, PlanResourceLimits>;

/**
 * @deprecated Use PLAN_LIMITS_FALLBACK — renamed in Story 11-1.
 * Kept for backwards-compat; callers can migrate at their own pace.
 */
export const PLAN_LIMITS = PLAN_LIMITS_FALLBACK;

export interface PlanResourceLimits {
  groups: number;
  membersPerGroup: number;
  leadersPerTenant: number;
}

export type PlanLimitedResource = keyof PlanResourceLimits;

export function getLimit(
  plan: TenantPlan,
  resource: PlanLimitedResource,
): number {
  return PLAN_LIMITS_FALLBACK[plan][resource];
}
