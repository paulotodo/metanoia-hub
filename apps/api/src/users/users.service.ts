import { Injectable, Logger } from '@nestjs/common';
import type { OnboardingCompleteResponse, UserExportData } from '@metanoia/types';
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
   * Export all personal data for a given user across all tenants.
   * Privileged context — runs without RLS (worker mode). Never throws.
   * CL-02/dec-019: excludes tenantId from profile (internal metadata).
   */
  async exportUserData(userId: string, _tenantId: string): Promise<UserExportData> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        onboardingCompletedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const userTenants = await this.prisma.client.userTenant.findMany({
      where: { userId },
      select: { tenantId: true, role: true, createdAt: true },
    });

    return {
      profile: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            status: user.status,
            onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          }
        : null,
      tenants: userTenants.map((ut) => ({
        tenantId: ut.tenantId,
        role: ut.role,
        joinedAt: ut.createdAt.toISOString(),
      })),
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
