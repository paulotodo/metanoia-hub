import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AssociateTrailsResponseSchema,
  GroupTrailsListResponseSchema,
  type AssociateTrailsResponse,
  type GroupTrailsListResponse,
} from '@metanoia/types';
import { envelopeClient } from '../envelope';

export const groupTrailsKeys = {
  all: ['group-trails'] as const,
  byGroup: (groupId: string) => [...groupTrailsKeys.all, groupId] as const,
};

/** List all trails associated with a group. */
export function useGroupTrails(groupId: string) {
  return useQuery<GroupTrailsListResponse>({
    queryKey: groupTrailsKeys.byGroup(groupId),
    queryFn: () =>
      envelopeClient.get(
        `/groups/${groupId}/trails`,
        GroupTrailsListResponseSchema,
      ),
    enabled: groupId.length > 0,
    staleTime: 30_000,
  });
}

/** Bulk-associate trails to a group. */
export function useAssociateTrails(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation<AssociateTrailsResponse, Error, { trailIds: string[] }>({
    mutationFn: (body) =>
      envelopeClient.post(
        `/groups/${groupId}/trails`,
        body,
        AssociateTrailsResponseSchema,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: groupTrailsKeys.byGroup(groupId),
      });
    },
  });
}

/** Remove a trail association from a group. */
export function useUnassignTrail(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation<undefined, Error, { trailId: string }>({
    mutationFn: async ({ trailId }) => {
      await envelopeClient.delete(`/groups/${groupId}/trails/${trailId}`);
      return undefined;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: groupTrailsKeys.byGroup(groupId),
      });
    },
  });
}
