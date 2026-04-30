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

  async getPlan(tenantId: string): Promise<TenantPlan> {
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    return (tenant?.plan ?? 'free') as TenantPlan;
  }

  async countResource(
    tenantId: string,
    resource: PlanLimitedResource,
  ): Promise<number> {
    switch (resource) {
      case 'groups':
        return this.prisma.client.group.count({ where: { tenantId } });
      case 'leadersPerTenant':
        return this.prisma.client.userTenant.count({
          where: { tenantId, role: 'lider' },
        });
      case 'membersPerGroup':
        // Per-group caps are enforced inline by the caller (GroupMember
        // create flow knows the groupId); the guard exposes the cap value
        // so callers don't hardcode it.
        throw new Error(
          'membersPerGroup is per-group; use getLimit() and count manually',
        );
    }
  }

  async hasCapacity(
    tenantId: string,
    resource: PlanLimitedResource,
  ): Promise<{ allowed: boolean; current: number; limit: number; plan: TenantPlan }> {
    const plan = await this.getPlan(tenantId);
    const limit = getLimit(plan, resource);
    if (resource === 'membersPerGroup') {
      // Not tenant-wide; caller must check.
      return { allowed: true, current: 0, limit, plan };
    }
    const current = await this.countResource(tenantId, resource);
    return { allowed: current < limit, current, limit, plan };
  }
}
