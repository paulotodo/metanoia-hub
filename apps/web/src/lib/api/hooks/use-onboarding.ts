import { useQuery } from '@tanstack/react-query';
import { DemoRadarResponseSchema } from '@metanoia/types';
import { apiClient } from '../client';

export const onboardingKeys = {
  all: ['onboarding'] as const,
  demoRadar: () => [...onboardingKeys.all, 'demo-radar'] as const,
};

export function useDemoRadar() {
  return useQuery({
    queryKey: onboardingKeys.demoRadar(),
    queryFn: () =>
      apiClient.get('/onboarding/demo-radar', DemoRadarResponseSchema),
    staleTime: 1000 * 60 * 5,
  });
}
