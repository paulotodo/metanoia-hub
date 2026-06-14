import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PlanLimitsService } from '../common/plan-limits/plan-limits.service';
import { RedisService } from '../redis/redis.service';
import { SuperAdminPlansRepository } from './super-admin-plans.repository';
import type { PatchSubscriptionPlanInput, SubscriptionPlan } from '@metanoia/types';

/** UUID v4/v7 regex — used for SEC-3.4 path injection prevention */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SuperAdminPlansService — business logic for global SubscriptionPlan management.
 *
 * Endpoints (US4):
 *   GET  /api/v1/admin/super/plans           — list active plans with tenant count
 *   PATCH /api/v1/admin/super/plans/:planId  — update limits/features/metadata
 *
 * Story 11-1 / US4, US5 (override on tenant side is in super-admin-tenants.service).
 */
@Injectable()
export class SuperAdminPlansService {
  private readonly logger = new Logger(SuperAdminPlansService.name);

  constructor(
    private readonly repo: SuperAdminPlansRepository,
    private readonly planLimitsService: PlanLimitsService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Returns all active plans with tenantCount populated.
   * US4 AC#1.
   */
  async listPlans(): Promise<{ data: SubscriptionPlan[] }> {
    const plans = await this.repo.findAll();

    const data = await Promise.all(
      plans.map(async (plan) => {
        const tenantCount = await this.repo.countTenantsByPlan(plan.tier);
        return {
          id: plan.id,
          name: plan.name,
          tier: plan.tier as SubscriptionPlan['tier'],
          limits: plan.limits as SubscriptionPlan['limits'],
          features: (plan.features ?? {}) as Record<string, unknown>,
          metadata: (plan.metadata ?? {}) as Record<string, unknown>,
          isActive: plan.isActive,
          createdAt: plan.createdAt.toISOString(),
          updatedAt: plan.updatedAt.toISOString(),
          tenantCount,
        };
      }),
    );

    return { data };
  }

  /**
   * Updates a plan's limits/features/metadata + write-through Redis for all tenants on that tier.
   *
   * SEC-3.4: planId validated as UUID to prevent path injection.
   * C2: write-through via Redis pipeline (not DEL — SET directly).
   * US4 AC#3.
   */
  async patchPlan(
    planId: string,
    dto: PatchSubscriptionPlanInput,
  ): Promise<{ data: SubscriptionPlan }> {
    // SEC-3.4: validate planId as UUID before any DB operation
    if (!UUID_REGEX.test(planId)) {
      throw new BadRequestException(
        `planId must be a valid UUID; received: ${planId}`,
      );
    }

    // Throws NotFoundException if not found
    const existing = await this.repo.findByIdOrThrow(planId);

    // Build update payload
    const updateData: Prisma.SubscriptionPlanUpdateInput = {};
    if (dto.limits !== undefined) updateData.limits = dto.limits as Prisma.InputJsonValue;
    if (dto.features !== undefined) updateData.features = dto.features as Prisma.InputJsonValue;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await this.repo.updateLimits(planId, updateData);

    // Write-through Redis: invalidate all tenant caches for this tier (C2)
    // Use pipeline for batch SET (NEVER DEL — write-through, not invalidate)
    try {
      const tenants = await this.repo.findTenantsByPlan(existing.tier);
      if (tenants.length > 0) {
        const pipeline = this.redis.pipeline();

        for (const tenant of tenants) {
          // Get resolved limits for this tenant via getLimits (handles override + null→Infinity)
          // For write-through we use the resolved limits from the service
          const resolved = await this.planLimitsService.getLimits(tenant.id);
          pipeline.set(
            `cache:plan-limits:${tenant.id}`,
            JSON.stringify(resolved),
          );
        }

        await pipeline.exec();
        this.logger.log(
          `Write-through: updated cache for ${tenants.length} tenants on plan ${existing.tier}`,
        );
      }
    } catch (err) {
      // Write-through failure is non-fatal — DB is source of truth
      this.logger.warn(
        `Write-through failed for plan ${planId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const data: SubscriptionPlan = {
      id: updated.id,
      name: updated.name,
      tier: updated.tier as SubscriptionPlan['tier'],
      limits: updated.limits as SubscriptionPlan['limits'],
      features: (updated.features ?? {}) as Record<string, unknown>,
      metadata: (updated.metadata ?? {}) as Record<string, unknown>,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    return { data };
  }
}
