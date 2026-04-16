import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ChurchOverviewResponseSchema,
  GroupTimelineResponseSchema,
  LeaderViewResponseSchema,
  OutreachIntentResponseSchema,
  type ChurchOverviewResponse,
  type CreateOutreachIntentRequest,
  type GroupTimelineResponse,
  type LeaderViewResponse,
  type OutreachIntentResponse,
  type UpdateOutreachIntentRequest,
} from '@metanoia/types';
import { envelopeClient } from '../envelope';

export const pastoralAdminKeys = {
  all: ['pastoral-admin'] as const,
  overview: () => [...pastoralAdminKeys.all, 'overview'] as const,
  timeline: (groupId: string) =>
    [...pastoralAdminKeys.all, 'timeline', groupId] as const,
  leader: (leaderId: string) =>
    [...pastoralAdminKeys.all, 'leader', leaderId] as const,
};

export function useGroupsAggregated() {
  return useQuery<ChurchOverviewResponse>({
    queryKey: pastoralAdminKeys.overview(),
    queryFn: () =>
      envelopeClient.get(
        '/admin/church/overview',
        ChurchOverviewResponseSchema,
      ),
  });
}

export function useGroupTimeline(groupId: string) {
  return useQuery<GroupTimelineResponse>({
    queryKey: pastoralAdminKeys.timeline(groupId),
    queryFn: () =>
      envelopeClient.get(
        `/admin/church/groups/${groupId}/timeline`,
        GroupTimelineResponseSchema,
      ),
    enabled: Boolean(groupId),
  });
}

export function useLeaderView(leaderId: string) {
  return useQuery<LeaderViewResponse>({
    queryKey: pastoralAdminKeys.leader(leaderId),
    queryFn: () =>
      envelopeClient.get(
        `/admin/church/leaders/${leaderId}`,
        LeaderViewResponseSchema,
      ),
    enabled: Boolean(leaderId),
  });
}

export function useCreateOutreachIntent(leaderId: string) {
  const queryClient = useQueryClient();
  return useMutation<OutreachIntentResponse, Error, CreateOutreachIntentRequest>(
    {
      mutationFn: (body) =>
        envelopeClient.post(
          '/admin/outreach-intents',
          body,
          OutreachIntentResponseSchema,
        ),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: pastoralAdminKeys.leader(leaderId),
        });
      },
    },
  );
}

export function useUpdateOutreachIntent(leaderId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    OutreachIntentResponse,
    Error,
    { intentId: string; body: UpdateOutreachIntentRequest }
  >({
    mutationFn: ({ intentId, body }) =>
      envelopeClient.put(
        `/admin/outreach-intents/${intentId}`,
        body,
        OutreachIntentResponseSchema,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pastoralAdminKeys.leader(leaderId),
      });
    },
  });
}

export function useDeleteOutreachIntent(leaderId: string) {
  const queryClient = useQueryClient();
  return useMutation<undefined, Error, string>({
    mutationFn: async (intentId) => {
      await envelopeClient.delete(`/admin/outreach-intents/${intentId}`);
      return undefined;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pastoralAdminKeys.leader(leaderId),
      });
    },
  });
}
