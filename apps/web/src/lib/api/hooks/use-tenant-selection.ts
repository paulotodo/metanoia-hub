import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MyTenantsDataSchema,
  SelectTenantDataSchema,
} from '@metanoia/types';
import type { SelectTenantInput } from '@metanoia/types';
import { apiClient } from '../client';

export const tenantSelectionKeys = {
  all: ['tenant-selection'] as const,
  myTenants: () => [...tenantSelectionKeys.all, 'my-tenants'] as const,
};

export function useMyTenants() {
  return useQuery({
    queryKey: tenantSelectionKeys.myTenants(),
    queryFn: () => apiClient.get('/auth/my-tenants', MyTenantsDataSchema),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSelectTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: SelectTenantInput) =>
      apiClient.post('/auth/select-tenant', SelectTenantDataSchema, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantSelectionKeys.all });
    },
  });
}
