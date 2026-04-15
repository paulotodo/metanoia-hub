import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MeetingDetailSchema,
  OpenRoomResponseSchema,
  EndRoomResponseSchema,
  CreateReflectionResponseSchema,
} from '@metanoia/types';
import type { CreateReflectionInput } from '@metanoia/types';
import { apiClient } from '../client';

export const meetingsKeys = {
  all: ['meetings'] as const,
  detail: (meetingId: string) =>
    [...meetingsKeys.all, 'detail', meetingId] as const,
};

export function useMeetingDetail(meetingId: string) {
  return useQuery({
    queryKey: meetingsKeys.detail(meetingId),
    queryFn: () =>
      apiClient.get(`/meetings/${meetingId}`, MeetingDetailSchema),
    enabled: meetingId.length > 0,
    staleTime: 1000 * 30,
  });
}

export function useOpenRoom(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient.post(
        `/meetings/${meetingId}/room`,
        OpenRoomResponseSchema,
        undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: meetingsKeys.detail(meetingId),
      });
    },
  });
}

export function useEndRoom(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient.post(
        `/meetings/${meetingId}/room/end`,
        EndRoomResponseSchema,
        undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: meetingsKeys.detail(meetingId),
      });
    },
  });
}

export function useCreateReflection(meetingId: string) {
  return useMutation({
    mutationFn: (body: CreateReflectionInput) =>
      apiClient.post(
        `/meetings/${meetingId}/reflections`,
        CreateReflectionResponseSchema,
        body,
      ),
  });
}
