import type { TenantPlan } from '@metanoia/types';

/**
 * Story 3-3 — Plan Limits Hardcoded.
 *
 * Hard caps per plan for resources that grow over time. These are the MVP
 * caps; Release 1b (Epic 11) replaces this with dynamic plans table.
 *
 * Conventions:
 *  - Number = hard cap. Creating the (cap+1)th resource is rejected with 403.
 *  - `Infinity` = no cap (enterprise tier).
 */
export const PLAN_LIMITS = {
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
  return PLAN_LIMITS[plan][resource];
}
