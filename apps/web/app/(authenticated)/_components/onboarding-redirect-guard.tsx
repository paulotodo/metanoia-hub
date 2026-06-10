'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOnboardingStatus } from '@/lib/api/hooks/use-users';
import { useCurrentRole } from '@/lib/session/use-current-role';

const WELCOME_PATHS = new Set([
  '/app/admin/boas-vindas',
  '/app/gestao/boas-vindas',
  '/app/consumo/boas-vindas',
]);

function welcomePathForRole(role: string | null): string | null {
  switch (role) {
    case 'super_admin':
    case 'admin_tenant':
      return '/app/admin/boas-vindas';
    case 'lider':
      return '/app/gestao/boas-vindas';
    case 'participante':
      return '/app/consumo/boas-vindas';
    default:
      return null;
  }
}

/**
 * Transparent guard: on every authenticated page load, checks whether
 * onboarding_completed_at is null. If so, redirects to the role-specific
 * welcome screen. Does nothing if already on a welcome path (loop prevention).
 *
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
  const { data, isSuccess } = useOnboardingStatus();

  useEffect(() => {
    // Don't redirect if already on a welcome path (loop prevention)
    if (WELCOME_PATHS.has(pathname)) return;

    // Wait until both role and onboarding status are available
    if (!isSuccess || !role) return;

    // If onboarding not complete, redirect to role-specific welcome page
    if (data?.onboardingCompletedAt === null) {
      const target = welcomePathForRole(role);
      if (target) {
        router.replace(target);
      }
    }
  }, [pathname, isSuccess, data, role, router]);

  return <>{children}</>;
}
