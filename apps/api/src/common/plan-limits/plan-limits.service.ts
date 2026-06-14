import { Injectable, Logger } from '@nestjs/common';
import type { TenantPlan } from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import {
  PLAN_LIMITS_FALLBACK,
  getLimit,
  type PlanLimitedResource,
} from './plan-limits.config';

/**
 * Resolved limits shape returned by getLimits().
 * Infinity encodes "no cap" (enterprise / null in DB — C3).
 */
export interface ResolvedPlanLimits {
  maxGroups: number;
  maxMembersPerGroup: number;
  maxLeadersPerTenant: number;
}

/** Maps a JSONB null/undefined limit value to the fallback number (C3). */
function toLimit(val: number | null | undefined, fallback: number): number {
  if (val === null || val === undefined) return fallback;
  return val;
}

/**
 * Story 3-3: PlanLimitsService — hasCapacity / getPlan (hardcoded).
 * Story 11-1: getLimits(tenantId) — dynamic (Redis → DB → fallback).
 *
 * Looks up the current tenant's plan and counts existing resources of a
 * given kind. Used by `PlanLimitsGuard` to compare against the dynamic cap.
 * Wraps reads in `withTenantTx` so SET LOCAL and the queries land on the
 * same connection — the FORCE RLS policies on `tenants`/`groups`/
 * `user_tenants` reject queries when `current_setting('app.current_tenant_id')`
 * is empty/null.
 */
@Injectable()
export class PlanLimitsService {
  private readonly logger = new Logger(PlanLimitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Returns resolved limits for a tenant.
   * Triple-fallback — NEVER throws 500 (US2, US1 AC#4):
   *   1. Redis cache hit → return immediately (zero DB calls)
   *   2. DB cold read → tenant.plan + tenant.planLimitsOverride + subscriptionPlan.limits
   *      → merge override fields over plan defaults → write-through Redis → return
   *   3. Table empty / DB error → PLAN_LIMITS_FALLBACK + logger.warn (no 500)
   *
   * Override field semantics (US5 AC#3):
   *   - override[k] = positive integer → use it
   *   - override[k] = null → use plan default (null in override = "use default")
   *   - override[k] missing (undefined) → use plan default
   *
   * Enterprise null → Infinity (C3): planLimits[k] = null → Infinity via toLimit().
   */
  async getLimits(tenantId: string): Promise<ResolvedPlanLimits> {
    // 1. Cache hit
    const cacheKey = `cache:plan-limits:${tenantId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ResolvedPlanLimits;
      }
    } catch {
      // Redis unavailable — continue to DB fallback
    }

    // 2. DB cold read
    try {
      const tenant = await this.prisma.client.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { plan: true, planLimitsOverride: true },
      });

      const plan = (tenant.plan ?? 'free') as TenantPlan;
      const override = (tenant.planLimitsOverride ?? {}) as Record<string, number | null>;
      const fallbackPlan = PLAN_LIMITS_FALLBACK[plan];

      const planRecord = await this.prisma.client.subscriptionPlan.findFirst({
        where: { tier: plan, isActive: true },
      });

      if (!planRecord) {
        // Tier exists in DB but no active plan row — fall through to fallback
        this.logger.warn(
          `PlanLimitsService.getLimits(${tenantId}): SubscriptionPlan table empty, using fallback defaults`,
        );
        return {
          maxGroups: fallbackPlan.groups,
          maxMembersPerGroup: fallbackPlan.membersPerGroup,
          maxLeadersPerTenant: fallbackPlan.leadersPerTenant,
        };
      }

      const planLimits = planRecord.limits as Record<string, number | null>;

      // Merge: override value takes precedence over plan value; null in either → fallback
      const resolved: ResolvedPlanLimits = {
        maxGroups: toLimit(
          override['maxGroups'] ?? planLimits['maxGroups'],
          fallbackPlan.groups,
        ),
        maxMembersPerGroup: toLimit(
          override['maxMembersPerGroup'] ?? planLimits['maxMembersPerGroup'],
          fallbackPlan.membersPerGroup,
        ),
        maxLeadersPerTenant: toLimit(
          override['maxLeadersPerTenant'] ?? planLimits['maxLeadersPerTenant'],
          fallbackPlan.leadersPerTenant,
        ),
      };

      // Write-through: populate cache so next call is a hit (C2)
      try {
        await this.redis.set(cacheKey, JSON.stringify(resolved));
      } catch {
        // Redis write failure is non-fatal
      }

      return resolved;
    } catch (err) {
      // 3. Fallback — table empty, tenant not found, or any DB error
      this.logger.warn(
        `PlanLimitsService.getLimits(${tenantId}): DB read failed, using fallback defaults. Reason: ${err instanceof Error ? err.message : String(err)}`,
      );

      // Try to determine the plan for a better-targeted fallback; default to 'free'
      let plan: TenantPlan = 'free';
      try {
        const tenant = await this.prisma.client.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true },
        });
        if (tenant?.plan) plan = tenant.plan as TenantPlan;
      } catch {
        // ignore — use 'free'
      }

      const fb = PLAN_LIMITS_FALLBACK[plan];
      return {
        maxGroups: fb.groups,
        maxMembersPerGroup: fb.membersPerGroup,
        maxLeadersPerTenant: fb.leadersPerTenant,
      };
    }
  }

  /**
   * Story 3-3 / US3: Guard-facing capacity check.
   * Uses getLimits() for the dynamic limit value.
   * membersPerGroup always returns allowed:true (curto-circuito US3 AC#4 — enforce
   * permanece em group-members.service, NÃO mover).
   */
  async hasCapacity(
    tenantId: string,
    resource: PlanLimitedResource,
  ): Promise<{ allowed: boolean; current: number; limit: number; plan: TenantPlan }> {
    return withTenantTx(
      this.prisma,
      async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true },
        });
        const plan = (tenant?.plan ?? 'free') as TenantPlan;

        // US3 AC#4: membersPerGroup short-circuits — enforce is in group-members.service
        if (resource === 'membersPerGroup') {
          const limit = getLimit(plan, resource);
          return { allowed: true, current: 0, limit, plan };
        }

        let current = 0;
        if (resource === 'groups') {
          current = await tx.group.count({ where: { tenantId } });
        } else if (resource === 'leadersPerTenant') {
          current = await tx.userTenant.count({
            where: { tenantId, role: 'lider' },
          });
        }

        // Use dynamic limit from getLimits for the actual cap comparison
        const resolved = await this.getLimits(tenantId);
        const dynamicLimit =
          resource === 'groups'
            ? resolved.maxGroups
            : resource === 'leadersPerTenant'
              ? resolved.maxLeadersPerTenant
              : getLimit(plan, resource);

        return { allowed: current < dynamicLimit, current, limit: dynamicLimit, plan };
      },
      { tenantId },
    );
  }

  /** Kept for callers that only need the plan (no capacity check). */
  async getPlan(tenantId: string): Promise<TenantPlan> {
    const tenant = await withTenantTx(
      this.prisma,
      (tx) =>
        tx.tenant.findUnique({
          where: { id: tenantId },
          select: { plan: true },
        }),
      { tenantId },
    );
    return (tenant?.plan ?? 'free') as TenantPlan;
  }
}
