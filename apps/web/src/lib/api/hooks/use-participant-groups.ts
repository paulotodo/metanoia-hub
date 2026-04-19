import { useQuery } from '@tanstack/react-query';
import {
  ParticipantGroupDetailResponseSchema,
  ParticipantGroupsListResponseSchema,
  type ParticipantGroupDetailResponse,
  type ParticipantGroupsListResponse,
} from '@metanoia/types';
import { envelopeClient } from '../envelope';

export const participantGroupsKeys = {
  all: ['participant-groups'] as const,
  list: () => [...participantGroupsKeys.all, 'list'] as const,
  detail: (id: string) =>
    [...participantGroupsKeys.all, 'detail', id] as const,
};

export function useParticipantGroups() {
  return useQuery<ParticipantGroupsListResponse>({
    queryKey: participantGroupsKeys.list(),
    queryFn: () =>
      envelopeClient.get(
        '/participant/groups',
        ParticipantGroupsListResponseSchema,
      ),
    staleTime: 30_000,
  });
}

export function useParticipantGroup(id: string) {
  return useQuery<ParticipantGroupDetailResponse>({
    queryKey: participantGroupsKeys.detail(id),
    queryFn: () =>
      envelopeClient.get(
        `/participant/groups/${id}`,
        ParticipantGroupDetailResponseSchema,
      ),
    enabled: id.length > 0,
    staleTime: 30_000,
  });
}
