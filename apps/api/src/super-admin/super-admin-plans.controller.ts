import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { PatchSubscriptionPlanInputSchema } from '@metanoia/types';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SuperAdminPlansService } from './super-admin-plans.service';
import type { PatchSubscriptionPlanInput } from '@metanoia/types';

/**
 * SuperAdminPlansController — SUPER_ADMIN endpoints for global plan management.
 *
 * GET  /api/v1/admin/super/plans           — list active plans with tenantCount
 * PATCH /api/v1/admin/super/plans/:planId  — update limits/features/metadata
 *
 * SEC-3.4: planId UUID validation is enforced in SuperAdminPlansService.patchPlan().
 * Story 11-1 / US4.
 */
@Controller('api/v1/admin/super/plans')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminPlansController {
  constructor(private readonly service: SuperAdminPlansService) {}

  /**
   * GET /api/v1/admin/super/plans
   * Lists all active subscription plans with tenant count per tier.
   * US4 AC#1 — 200 { data: [...] }
   */
  @Get()
  async listPlans() {
    return this.service.listPlans();
  }

  /**
   * PATCH /api/v1/admin/super/plans/:planId
   * Updates limits/features/metadata of a specific plan.
   * Triggers write-through Redis invalidation for all tenants on that tier.
   * US4 AC#3 — 200 { data: {...} }
   * US4 AC#4 — 422 on invalid limits (Zod validation)
   * SEC-3.4 — 400 on non-UUID planId
   */
  @Patch(':planId')
  async patchPlan(
    @Param('planId') planId: string,
    @Body(new ZodValidationPipe(PatchSubscriptionPlanInputSchema))
    body: PatchSubscriptionPlanInput,
  ) {
    return this.service.patchPlan(planId, body);
  }
}
