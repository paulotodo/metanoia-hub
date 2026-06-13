import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DemoRadarResponseSchema, DemoStatusResponseSchema } from '@metanoia/types';
import { apiClient } from '../client';
import { envelopeClient } from '../envelope';

export const onboardingKeys = {
  all: ['onboarding'] as const,
  demoRadar: () => [...onboardingKeys.all, 'demo-radar'] as const,
  demoStatus: () => [...onboardingKeys.all, 'demo-status'] as const,
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
