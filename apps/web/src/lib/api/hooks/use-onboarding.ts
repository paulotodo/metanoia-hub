import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DemoRadarResponseSchema,
  DemoStatusResponseSchema,
  OnboardingStatusResponseSchema,
  UpdateTenantProfileResponseSchema,
  UpdateUserProfileResponseSchema,
  type UpdateTenantProfile,
  type UpdateUserProfile,
} from '@metanoia/types';
import { apiClient } from '../client';
import { envelopeClient } from '../envelope';

export const onboardingKeys = {
  all: ['onboarding'] as const,
  demoRadar: () => [...onboardingKeys.all, 'demo-radar'] as const,
  demoStatus: () => [...onboardingKeys.all, 'demo-status'] as const,
  wizardStatus: () => [...onboardingKeys.all, 'wizard-status'] as const,
};

export function useDemoRadar() {
  return useQuery({
    queryKey: onboardingKeys.demoRadar(),
    queryFn: () =>
      apiClient.get('/onboarding/demo-radar', DemoRadarResponseSchema),
    staleTime: 1000 * 60 * 5,
  });
}

// CHK016: refetchOnWindowFocus keeps status fresh after user returns from another tab
export function useDemoStatus() {
  return useQuery({
    queryKey: onboardingKeys.demoStatus(),
    queryFn: () =>
      apiClient.get('/onboarding/demo-status', DemoStatusResponseSchema),
    refetchOnWindowFocus: true,
  });
}

export function useDeleteDemoData() {
  const queryClient = useQueryClient();
  return useMutation<undefined, Error, undefined>({
    mutationFn: async (): Promise<undefined> => {
      await apiClient.delete('/onboarding/demo-data');
      return undefined;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingKeys.demoStatus() });
    },
  });
}

/**
 * Fetch tenant wizard status (progress + hasRealGroups). Server-derived — never computed in FE.
 *
 * The `/onboarding/status` endpoint is restricted to admin_tenant (RolesGuard).
 * Pass `enabled: false` for non-admin roles to avoid an expected-but-noisy 403.
 */
export function useWizardStatus(enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.wizardStatus(),
    queryFn: () =>
      apiClient.getEnvelope('/onboarding/status', OnboardingStatusResponseSchema),
    staleTime: 1000 * 60,
    enabled,
  });
}

/** Update tenant profile and/or onboarding progress. */
export function useUpdateTenantProfile() {
  const queryClient = useQueryClient();
  return useMutation<
    ReturnType<typeof UpdateTenantProfileResponseSchema.shape.data.parse>,
    Error,
    UpdateTenantProfile
  >({
    mutationFn: async (body: UpdateTenantProfile): Promise<ReturnType<typeof UpdateTenantProfileResponseSchema.shape.data.parse>> => {
      return apiClient.patch('/tenants/me', UpdateTenantProfileResponseSchema.shape.data, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingKeys.wizardStatus() });
    },
  });
}

/** Update user profile (name, profilePhotoUrl, roleTitle). */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation<
    ReturnType<typeof UpdateUserProfileResponseSchema.shape.data.parse>,
    Error,
    UpdateUserProfile
  >({
    mutationFn: async (body: UpdateUserProfile): Promise<ReturnType<typeof UpdateUserProfileResponseSchema.shape.data.parse>> => {
      return apiClient.patch('/users/me', UpdateUserProfileResponseSchema.shape.data, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'profile'] });
    },
  });
}

export function useDismissDemoNudge() {
  const queryClient = useQueryClient();
  return useMutation<undefined, Error, undefined>({
    mutationFn: async (): Promise<undefined> => {
      // PATCH returns 204 No Content; we use envelopeClient with a no-op schema
      await envelopeClient.patch(
        '/onboarding/demo-nudge-dismiss',
        {},
        { parse: () => undefined as unknown },
      );
      return undefined;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: onboardingKeys.demoStatus() });
    },
  });
}
