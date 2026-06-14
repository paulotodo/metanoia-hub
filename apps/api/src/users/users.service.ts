import { Injectable, Logger } from '@nestjs/common';
import type { CurrentUser, OnboardingCompleteResponse, UpdateUserProfile, UpdateUserProfileResponse, UserExportData } from '@metanoia/types';
import { UserStatusSchema } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { getRequestContext } from '../common/context/request-context';

export interface EmailCheckResult {
  email: string;
  exists: boolean;
}

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
   * Soft-delete user data scoped to one tenant (Story 9-2 / LGPD Art. 18 VI).
   * Sets deleted_at on user_tenants for this user+tenant.
   * Idempotent: guard `deleted_at IS NULL` means calling 2x = same result.
   * Note: consents are NOT touched here (LGPD art. 16 — retained).
   */
  async softDeleteUserData(userId: string, tenantId: string): Promise<void> {
    await this.prisma.client.$executeRaw`
      UPDATE user_tenants
      SET deleted_at = NOW()
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
        AND deleted_at IS NULL
    `;
    this.logger.log(`softDeleteUserData: user_tenants marked for userId=${userId} tenantId=${tenantId}`);
  }

  /**
   * Hard-delete user data scoped to one tenant (Story 9-2 / LGPD Art. 18 VI).
   * - Deletes user_tenants row.
   * - Anonymizes the users record (UPDATE, not DELETE — preserves FK chain).
   *   email = 'removed-<hash>@deleted.invalid' where hash = sha256(userId+salt)[:8]
   *   status = 'deleted'
   * Called inside a prisma.$transaction by the worker.
   */
  async hardDeleteUserData(
    userId: string,
    tenantId: string,
    tx: Parameters<Parameters<typeof this.prisma.client.$transaction>[0]>[0],
  ): Promise<void> {
    // Delete the tenant association
    await tx.$executeRaw`
      DELETE FROM user_tenants
      WHERE user_id = ${userId}::uuid
        AND tenant_id = ${tenantId}::uuid
    `;
    // Anonymize the user profile (keep row — preserves FK chain cross-tenant)
    const anonymizationSalt = process.env['ANONYMIZATION_SALT'] ?? 'metanoia-deletion-salt';
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256')
      .update(userId + anonymizationSalt)
      .digest('hex')
      .slice(0, 8);
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Usuário Removido',
        email: `removed-${hash}@deleted.invalid`,
        status: 'deleted',
      },
    });
    this.logger.log(`hardDeleteUserData: user_tenants deleted + user anonymized userId=${userId}`);
  }

  /**
   * Get current user profile including status (for deletion_pending banner).
   * AVS-02: useAuth() does not expose user.status — this endpoint provides it.
   */
  async getCurrentUser(): Promise<CurrentUser> {
    const { userId } = getRequestContext();
    if (!userId) throw new Error('getCurrentUser requires userId in RequestContext');
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, status: true },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: UserStatusSchema.parse(user.status),
    };
  }

  /**
   * Update the authenticated user's profile (Etapa 1 of the onboarding wizard).
   * PATCH /api/v1/users/me.
   *
   * dec-018 MUST: fields mapped explicitly — no spread-merge of dto.
   * Immutable fields (status, tenantId, email, onboardingCompletedAt) not touched.
   * userId resolved from AsyncLocalStorage — never from body or param (API5/BFLA).
   */
  async updateProfile(dto: UpdateUserProfile): Promise<UpdateUserProfileResponse> {
    const { userId } = getRequestContext();
    if (!userId) {
      throw new Error('updateProfile requires userId in RequestContext');
    }

    const user = await withTenantTx(this.prisma, (tx) =>
      tx.user.update({
        where: { id: userId },
        data: {
          // Explicit field mapping — anti-mass-assignment (dec-018)
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.profilePhotoUrl !== undefined ? { profilePhotoUrl: dto.profilePhotoUrl } : {}),
          ...(dto.roleTitle !== undefined ? { roleTitle: dto.roleTitle } : {}),
        },
        select: {
          id: true,
          name: true,
          profilePhotoUrl: true,
          roleTitle: true,
        },
      }),
    );

    return {
      data: {
        id: user.id,
        name: user.name,
        profilePhotoUrl: user.profilePhotoUrl ?? null,
        roleTitle: user.roleTitle ?? null,
      },
    };
  }

  /**
   * Check which emails from the provided list already exist within the current tenant.
   *
   * Tenant-scope: uses withTenantTx so the RLS policy on user_tenants confines
   * the lookup to the active tenant from AsyncLocalStorage. No cross-tenant leakage.
   *
   * Conflict API-10-C1 resolved: findMany does NOT preserve input order in Postgres.
   * We build a Set from DB results and re-map in input order.
   *
   * PII log policy (RQ-06-G1): only { checkedCount, tenantId } are logged — never
   * the email list itself.
   *
   * @param emails Normalised (lowercase, trimmed) email list; ≤ 500 items.
   */
  async checkEmailsInTenant(emails: string[]): Promise<EmailCheckResult[]> {
    const { tenantId } = getRequestContext();

    // RLS-aware query: withTenantTx sets the tenant context so that RLS policies
    // on user_tenants restrict which users are visible to this tenant.
    // We query users whose email is in the list AND who are members of this tenant.
    const dbRows = await withTenantTx(this.prisma, (tx) =>
      tx.user.findMany({
        where: {
          email: { in: emails },
          userTenants: {
            some: {
              deletedAt: null,
              // tenantId is injected by the Prisma RLS extension — no explicit filter needed
            },
          },
        },
        select: { email: true },
      }),
    );

    // Build Set for O(1) lookup — resolves API-10-C1 (DB does not preserve order)
    const found = new Set(dbRows.map((u) => u.email));

    // Preserve input order
    const results: EmailCheckResult[] = emails.map((email) => ({
      email,
      exists: found.has(email),
    }));

    // Log count only — PII policy (RQ-06-G1): never log the email list
    this.logger.log(
      { checkedCount: emails.length, tenantId, foundCount: found.size },
      'checkEmailsInTenant completed',
    );

    return results;
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
