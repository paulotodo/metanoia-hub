import { Injectable } from '@nestjs/common';
import type { TenantPlan } from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getLimit,
  type PlanLimitedResource,
} from './plan-limits.config';

/**
 * Looks up the current tenant's plan and counts existing resources of a
 * given kind. Used by `PlanLimitsGuard` to compare against the hardcoded
 * cap. Reads via the non-extended Prisma client to avoid a circular
 * dependency with RLS on the `tenants` row itself (the RLS policy grants
 * SELECT on the user's own tenant, but the guard runs before any other
 * tenant-scoped query, so we use the admin client for the plan lookup).
 */
@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Wraps the lookup in a transaction that SETs `app.current_tenant_id` so
   * the FORCE RLS policies on `tenants`/`groups`/`user_tenants` allow the
   * read. Without this, `current_setting(...)::uuid` of the empty default
   * raises `invalid input syntax for type uuid: ""`.
   */
  async hasCapacity(
    tenantId: string,
    resource: PlanLimitedResource,
  ): Promise<{ allowed: boolean; current: number; limit: number; plan: TenantPlan }> {
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      });
      const plan = (tenant?.plan ?? 'free') as TenantPlan;
      const limit = getLimit(plan, resource);

      if (resource === 'membersPerGroup') {
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

      return { allowed: current < limit, current, limit, plan };
    });
  }

  /** Kept for callers that only need the plan (no capacity check). */
  async getPlan(tenantId: string): Promise<TenantPlan> {
    const tenant = await this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      return tx.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      });
    });
    return (tenant?.plan ?? 'free') as TenantPlan;
  }
}
