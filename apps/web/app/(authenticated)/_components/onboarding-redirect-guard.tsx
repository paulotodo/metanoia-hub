'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOnboardingStatus } from '@/lib/api/hooks/use-users';
import { useWizardStatus } from '@/lib/api/hooks/use-onboarding';
import { useCurrentRole } from '@/lib/session/use-current-role';

const WELCOME_PATHS = new Set([
  '/app/admin/boas-vindas',
  '/app/gestao/boas-vindas',
  '/app/consumo/boas-vindas',
]);

function welcomePathForRole(role: string | null): string | null {
  switch (role) {
    case 'admin_tenant':
      return '/app/admin/boas-vindas';
    case 'lider':
      return '/app/gestao/boas-vindas';
    case 'participante':
      return '/app/consumo/boas-vindas';
    default:
      // super_admin and unknown roles: no wizard redirect
      return null;
  }
}

/**
 * Transparent guard: on every authenticated page load, checks whether the
 * user/tenant should be redirected to the onboarding wizard.
 *
 * For admin_tenant: uses the TRIPLE condition (FR-01):
 *   progress.completed === false AND progress.skippedAt === null AND hasRealGroups === false
 *   super_admin is never redirected.
 *
 * For lider / participante: uses the legacy user-scoped condition
 *   (onboardingCompletedAt === null from User table, Story 7-1).
 *
 * Does nothing if already on a welcome path (loop prevention).
 * Renders children unconditionally — redirect happens in useEffect so there
 * is no flash of wrong content during the API round-trip.
 */
export function OnboardingRedirectGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useCurrentRole();

  // User-scoped status (Story 7-1) — used for lider / participante
  const { data: userOnboarding, isSuccess: userSuccess } = useOnboardingStatus();

  // Tenant-scoped wizard status — used for admin_tenant (FR-01 triple condition)
  const { data: wizardStatus, isSuccess: wizardSuccess } = useWizardStatus();

  useEffect(() => {
    // Loop prevention: don't redirect if already on a welcome path
    if (WELCOME_PATHS.has(pathname)) return;

    // Wait until role is resolved
    if (!role) return;

    // super_admin never goes through the wizard
    if (role === 'super_admin') return;

    if (role === 'admin_tenant') {
      // Must wait for wizard status (tenant-scoped)
      if (!wizardSuccess || !wizardStatus) return;

      const progress = wizardStatus.data.progress;
      const hasRealGroups = wizardStatus.data.hasRealGroups;

      // Triple condition (FR-01): all three must be true to trigger redirect
      const shouldRedirect =
        progress.completed === false &&
        progress.skippedAt === null &&
        hasRealGroups === false;

      if (shouldRedirect) {
        router.replace('/app/admin/boas-vindas');
      }
      return;
    }

    // lider / participante: legacy user-scoped condition (Story 7-1)
    if (!userSuccess) return;

    if (userOnboarding?.onboardingCompletedAt === null) {
      const target = welcomePathForRole(role);
      if (target) {
        router.replace(target);
      }
    }
  }, [pathname, role, wizardSuccess, wizardStatus, userSuccess, userOnboarding, router]);

  return <>{children}</>;
}
