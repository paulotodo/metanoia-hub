import { Injectable } from '@nestjs/common';
import type { OnboardingStatusResponse } from '@metanoia/types';
import { OnboardingProgressSchema, ONBOARDING_PROGRESS_DEFAULT } from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

/**
 * OnboardingWizardService — GET /api/v1/onboarding/status.
 *
 * Returns tenant-scoped wizard progress + derived hasRealGroups flag.
 * Distinct from the user-scoped GET /api/v1/users/me/onboarding-status
 * (which reads User.onboardingCompletedAt from Story 7-1).
 *
 * hasRealGroups is always computed server-side via GROUP COUNT (RLS-scoped).
 * Decision 6: FE never derives this flag.
 */
@Injectable()
export class OnboardingWizardService {
  constructor(private readonly prisma: PrismaService) {}

  async getWizardStatus(): Promise<OnboardingStatusResponse> {
    const { tenantId } = getRequestContext();

    const result = await withTenantTx(this.prisma, async (tx) => {
      const [tenant, groupCount] = await Promise.all([
        tx.tenant.findUnique({
          where: { id: tenantId },
          select: { onboardingProgress: true },
        }),
        tx.group.count({ where: { tenantId } }),
      ]);

      return { onboardingProgress: tenant?.onboardingProgress ?? null, groupCount };
    });

    // Parse persisted JSONB or fall back to default (never null in response)
    let progress = ONBOARDING_PROGRESS_DEFAULT;
    if (result.onboardingProgress != null) {
      const parsed = OnboardingProgressSchema.safeParse(result.onboardingProgress);
      if (parsed.success) {
        progress = parsed.data;
      }
    }

    return {
      data: {
        progress,
        hasRealGroups: result.groupCount > 0,
      },
    };
  }
}
