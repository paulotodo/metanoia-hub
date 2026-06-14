import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SuperAdminPlansRepository — CRUD against the global `subscription_plans` table.
 *
 * subscription_plans is a global table (no tenant_id / no RLS).
 * Only SUPER_ADMIN can modify it. Reads bypass RLS intentionally (global config).
 * Uses prisma.client (non-RLS connection by design — documented).
 *
 * Story 11-1 / US4, FR-INFRA-02, FR-INFRA-06.
 */
@Injectable()
export class SuperAdminPlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all active subscription plans ordered by creation date.
   * Used by listPlans() to enumerate tiers for SUPER_ADMIN.
   */
  async findAll() {
    return this.prisma.client.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Finds a plan by id; throws NotFoundException if not found.
   * Used before PATCH to validate existence (SEC-3.4 flow).
   */
  async findByIdOrThrow(id: string) {
    const plan = await this.prisma.client.subscriptionPlan.findFirst({
      where: { id },
    });
    if (!plan) {
      throw new NotFoundException(`SubscriptionPlan not found: ${id}`);
    }
    return plan;
  }

  /**
   * Updates mutable fields of a subscription plan.
   * Caller is responsible for write-through cache invalidation.
   */
  async updateLimits(
    id: string,
    data: Prisma.SubscriptionPlanUpdateInput,
  ) {
    return this.prisma.client.subscriptionPlan.update({
      where: { id },
      data,
    });
  }

  /**
   * Returns all tenant IDs on a given plan tier.
   * Uses idx_tenants_plan for efficient WHERE plan = $1 (CT-5).
   */
  async findTenantsByPlan(tier: string): Promise<{ id: string }[]> {
    return this.prisma.client.tenant.findMany({
      where: { plan: tier },
      select: { id: true },
    });
  }

  /**
   * Counts the number of tenants on each plan tier.
   * Used by listPlans() to populate tenantCount.
   */
  async countTenantsByPlan(tier: string): Promise<number> {
    return this.prisma.client.tenant.count({ where: { plan: tier } });
  }
}
