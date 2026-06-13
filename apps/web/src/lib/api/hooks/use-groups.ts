import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GroupResponseSchema, GroupsListResponseSchema } from '@metanoia/types';
import type { CreateGroupRequest } from '@metanoia/types';
import { apiClient } from '../client';
import { radarKeys } from './use-radar';

export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
};

export function useGroupsList() {
  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: () => apiClient.getEnvelope('/groups', GroupsListResponseSchema),
    staleTime: 1000 * 60,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateGroupRequest) =>
      apiClient.post('/groups', GroupResponseSchema, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
      queryClient.invalidateQueries({ queryKey: radarKeys.all });
    },
  });
}
