import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MeetingDetailSchema,
  MeetingResponseSchema,
  MeetingsListResponseSchema,
  JoinMeetingResponseSchema,
  OpenRoomResponseSchema,
  EndRoomResponseSchema,
  CreateReflectionResponseSchema,
} from '@metanoia/types';
import type {
  CreateMeetingRequest,
  CreateReflectionInput,
  MeetingsListQuery,
  UpdateMeetingRequest,
} from '@metanoia/types';
import { apiClient } from '../client';

export const meetingsKeys = {
  all: ['meetings'] as const,
  list: (query: Partial<MeetingsListQuery>) =>
    [...meetingsKeys.all, 'list', query] as const,
  detail: (meetingId: string) =>
    [...meetingsKeys.all, 'detail', meetingId] as const,
};

function buildListQueryString(query: Partial<MeetingsListQuery>): string {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.perPage !== undefined)
    params.set('perPage', String(query.perPage));
  if (query.status) params.set('status', query.status);
  if (query.groupId) params.set('groupId', query.groupId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useMeetingsList(query: Partial<MeetingsListQuery> = {}) {
  return useQuery({
    queryKey: meetingsKeys.list(query),
    queryFn: () =>
      apiClient.getEnvelope(
        `/meetings${buildListQueryString(query)}`,
        MeetingsListResponseSchema,
      ),
    staleTime: 1000 * 15,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMeetingRequest) =>
      apiClient.post('/meetings', MeetingResponseSchema, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingsKeys.all });
    },
  });
}

export function useUpdateMeeting(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeetingRequest) =>
      apiClient.patch(`/meetings/${meetingId}`, MeetingResponseSchema, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingsKeys.all });
    },
  });
}

export function useCancelMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => apiClient.delete(`/meetings/${meetingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: meetingsKeys.all });
    },
  });
}

export function useJoinMeeting() {
  return useMutation({
    mutationFn: (meetingId: string) =>
      apiClient.post(
        `/meetings/${meetingId}/join`,
        JoinMeetingResponseSchema,
        undefined,
      ),
  });
}

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
