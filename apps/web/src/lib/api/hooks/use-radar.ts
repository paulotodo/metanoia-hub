import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RadarPageDataSchema,
  SignalDetailSchema,
  ParticipantProfileSchema,
  CareActionResponseSchema,
  RadarDashboardResponseSchema,
  ParticipantTimelineSchema,
  NudgeListResponseSchema,
  StatusImprovedListResponseSchema,
} from '@metanoia/types';
import type {
  CareActionRequest,
  RadarDashboardResponse,
  NudgeListResponse,
  StatusImprovedListResponse,
} from '@metanoia/types';
import { apiClient } from '../client';
import { envelopeClient } from '../envelope';

// --- Query Keys ---

export const radarKeys = {
  all: ['radar'] as const,
  dashboard: () => [...radarKeys.all, 'dashboard'] as const,
  page: (groupId?: string) =>
    [...radarKeys.all, 'page', groupId ?? 'all'] as const,
  detail: (participantId: string) =>
    [...radarKeys.all, 'detail', participantId] as const,
  profile: (participantId: string) =>
    [...radarKeys.all, 'profile', participantId] as const,
  timeline: (participantId: string) =>
    [...radarKeys.all, 'timeline', participantId] as const,
  nudges: (groupId?: string) =>
    [...radarKeys.all, 'nudges', groupId ?? 'all'] as const,
  celebrations: (groupId?: string) =>
    [...radarKeys.all, 'celebrations', groupId ?? 'all'] as const,
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

// --- GET /radar/dashboard (Story 6-6) ---
// Polling a cada 30s: vista analítica não usa SSE, atualiza por intervalo.
// Admin vê todos os grupos; líder vê apenas os seus (guardrail server-side).

export function useRadarDashboard() {
  return useQuery<RadarDashboardResponse>({
    queryKey: radarKeys.dashboard(),
    queryFn: () =>
      envelopeClient.get('/radar/dashboard', RadarDashboardResponseSchema),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}

// --- GET /radar/:id/timeline (Story 6-4) ---
// Merged individual timeline: presence signals + pastoral care actions, descending.

export function useParticipantTimeline(participantId: string) {
  return useQuery({
    queryKey: radarKeys.timeline(participantId),
    queryFn: () =>
      apiClient.get(
        `/radar/${participantId}/timeline`,
        ParticipantTimelineSchema,
      ),
    enabled: !!participantId,
  });
}

// --- GET /radar/nudges (Story 6-5) ---

export function useRadarNudges(groupId?: string) {
  return useQuery<NudgeListResponse>({
    queryKey: radarKeys.nudges(groupId),
    queryFn: () => {
      const params = groupId ? `?groupId=${groupId}` : '';
      return apiClient.get(`/radar/nudges${params}`, NudgeListResponseSchema);
    },
  });
}

// --- GET /radar/celebrations (Story 6-5) ---

export function useRadarCelebrations(groupId?: string) {
  return useQuery<StatusImprovedListResponse>({
    queryKey: radarKeys.celebrations(groupId),
    queryFn: () => {
      const params = groupId ? `?groupId=${groupId}` : '';
      return apiClient.get(
        `/radar/celebrations${params}`,
        StatusImprovedListResponseSchema,
      );
    },
    // Refresh every 2 minutes — celebration events are short-lived (24h window)
    refetchInterval: 2 * 60 * 1000,
    staleTime: 90 * 1000,
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
