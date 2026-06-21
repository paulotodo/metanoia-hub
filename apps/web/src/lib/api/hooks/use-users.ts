import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OnboardingCompleteResponseSchema,
} from '@metanoia/types';
import { apiClient } from '../client';

// Inline schema for the onboarding-status response using only @metanoia/types exports
// (no direct zod dep in apps/web — composed from shared types)
const OnboardingStatusSchema = {
  parse(data: unknown): { onboardingCompletedAt: string | null } {
    if (
      data !== null &&
      typeof data === 'object' &&
      'onboardingCompletedAt' in data
    ) {
      const val = (data as Record<string, unknown>).onboardingCompletedAt;
      if (val === null || typeof val === 'string') {
        return { onboardingCompletedAt: val as string | null };
      }
    }
    throw new Error('Invalid onboarding status response');
  },
};

export const usersKeys = {
  all: ['users'] as const,
  onboardingStatus: () => [...usersKeys.all, 'onboarding-status'] as const,
};

/**
 * Fetch the authenticated user's onboarding status.
 *
 * Pass `enabled: false` to skip the request for roles that don't use the
 * user-scoped onboarding flow (admin_tenant uses the tenant wizard instead).
 */
export function useOnboardingStatus(enabled = true) {
  return useQuery({
    queryKey: usersKeys.onboardingStatus(),
    queryFn: () =>
      apiClient.get('/users/me/onboarding-status', OnboardingStatusSchema),
    staleTime: 1000 * 60 * 5,
    enabled,
  });
}

/** Mark onboarding complete. Invalidates the status query. */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.patch(
        '/users/me/onboarding-complete',
        OnboardingCompleteResponseSchema,
        {},
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.onboardingStatus() });
    },
  });
}
