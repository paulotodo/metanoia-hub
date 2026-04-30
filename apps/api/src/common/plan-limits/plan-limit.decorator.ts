import { SetMetadata } from '@nestjs/common';
import type { PlanLimitedResource } from './plan-limits.config';

export const PLAN_LIMIT_META = 'plan-limit:resource';

/**
 * Marks a route as gated by a tenant-scoped plan limit. The associated
 * `PlanLimitsGuard` reads this metadata and rejects the request with 403
 * when the tenant has reached the hardcoded cap for the resource.
 *
 *   @PlanLimit('groups')
 *   @Post()
 *   create(...) { ... }
 */
export const PlanLimit = (resource: PlanLimitedResource) =>
  SetMetadata(PLAN_LIMIT_META, resource);
