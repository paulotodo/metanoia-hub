import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RadarPageDataSchema,
  SignalDetailSchema,
  ParticipantProfileSchema,
  CareActionResponseSchema,
} from '@metanoia/types';
import type { CareActionRequest } from '@metanoia/types';
import { apiClient } from '../client';

// --- Query Keys ---

export const radarKeys = {
  all: ['radar'] as const,
  page: (groupId?: string) =>
    [...radarKeys.all, 'page', groupId ?? 'all'] as const,
  detail: (participantId: string) =>
    [...radarKeys.all, 'detail', participantId] as const,
  profile: (participantId: string) =>
    [...radarKeys.all, 'profile', participantId] as const,
};

// --- GET /radar ---

export function useRadarPage(groupId?: string) {
  return useQuery({
    queryKey: radarKeys.page(groupId),
    queryFn: () => {
      const params = groupId ? `?groupId=${groupId}` : '';
      return apiClient.get(`/radar${params}`, RadarPageDataSchema);
    },
  });
}

// --- GET /radar/:id ---

export function useSignalDetail(participantId: string) {
  return useQuery({
    queryKey: radarKeys.detail(participantId),
    queryFn: () =>
      apiClient.get(`/radar/${participantId}`, SignalDetailSchema),
    enabled: !!participantId,
  });
}

// --- GET /radar/:id/profile ---

export function useParticipantProfile(participantId: string) {
  return useQuery({
    queryKey: radarKeys.profile(participantId),
    queryFn: () =>
      apiClient.get(
        `/radar/${participantId}/profile`,
        ParticipantProfileSchema,
      ),
    enabled: !!participantId,
  });
}

// --- POST /radar/:id/actions ---

export function useRecordCareAction(participantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CareActionRequest) =>
      apiClient.post(
        `/radar/${participantId}/actions`,
        CareActionResponseSchema,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: radarKeys.all });
    },
  });
}
