import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GroupResponseSchema } from '@metanoia/types';
import type { CreateGroupRequest } from '@metanoia/types';
import { apiClient } from '../client';
import { radarKeys } from './use-radar';

export const groupKeys = {
  all: ['groups'] as const,
};

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
