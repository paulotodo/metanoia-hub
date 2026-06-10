import { Injectable, Logger } from '@nestjs/common';
import type { OnboardingCompleteResponse } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestContext } from '../common/context/request-context';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mark onboarding as complete for the authenticated user.
   * Idempotent — if already set, returns the existing timestamp.
   * Uses a direct update by userId (no tenant scoping needed here because
   * users.tenant_id IS NULL by design; see RLS policy on users table).
   */
  async completeOnboarding(): Promise<OnboardingCompleteResponse> {
    const { userId } = getRequestContext();
    if (!userId) {
      throw new Error('completeOnboarding requires userId in RequestContext');
    }

    const now = new Date();

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        onboardingCompletedAt: now,
      },
      select: {
        id: true,
        onboardingCompletedAt: true,
      },
    });

    this.logger.log(`Onboarding marked complete for user ${userId}`);

    return {
      userId: user.id,
      onboardingCompletedAt: (user.onboardingCompletedAt ?? now).toISOString(),
    };
  }

  /**
   * Check whether onboarding is complete for the authenticated user.
   * Returns the timestamp if set, or null if pending.
   */
  async getOnboardingStatus(): Promise<{ onboardingCompletedAt: string | null }> {
    const { userId } = getRequestContext();
    if (!userId) {
      throw new Error('getOnboardingStatus requires userId in RequestContext');
    }

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    });

    return {
      onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    };
  }
}
