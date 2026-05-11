import { Injectable } from '@nestjs/common';
import type { TenantPlan } from '@metanoia/types';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import {
  getLimit,
  type PlanLimitedResource,
} from './plan-limits.config';

/**
 * Looks up the current tenant's plan and counts existing resources of a
 * given kind. Used by `PlanLimitsGuard` to compare against the hardcoded
 * cap. Wraps reads in `withTenantTx` so SET LOCAL and the queries land on
 * the same connection — the FORCE RLS policies on `tenants`/`groups`/
 * `user_tenants` reject queries when `current_setting('app.current_tenant_id')`
 * is empty/null.
 */
@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

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
