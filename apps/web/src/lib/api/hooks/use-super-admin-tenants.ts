import { useQuery } from '@tanstack/react-query';
import {
  TenantDetailResponseSchema,
  TenantsListResponseSchema,
  type TenantDetailResponse,
  type TenantPlan,
  type TenantStatus,
  type TenantsListQuery,
  type TenantsListResponse,
} from '@metanoia/types';
import { envelopeClient } from '../envelope';

export interface UseSuperAdminTenantsArgs {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantStatus | '';
  plan?: TenantPlan | '';
  sortBy?: TenantsListQuery['sortBy'];
  sortDir?: TenantsListQuery['sortDir'];
}

export const superAdminTenantsKeys = {
  all: ['super-admin-tenants'] as const,
  list: (args: UseSuperAdminTenantsArgs) =>
    [...superAdminTenantsKeys.all, 'list', args] as const,
  detail: (id: string) =>
    [...superAdminTenantsKeys.all, 'detail', id] as const,
};

function buildQueryString(args: UseSuperAdminTenantsArgs): string {
  const params = new URLSearchParams();
  params.set('page', String(args.page ?? 1));
  params.set('limit', String(args.limit ?? 20));
  if (args.search) params.set('search', args.search);
  if (args.status) params.set('status', args.status);
  if (args.plan) params.set('plan', args.plan);
  if (args.sortBy) params.set('sortBy', args.sortBy);
  if (args.sortDir) params.set('sortDir', args.sortDir);
  return params.toString();
}

export function useSuperAdminTenants(args: UseSuperAdminTenantsArgs = {}) {
  return useQuery<TenantsListResponse>({
    queryKey: superAdminTenantsKeys.list(args),
    queryFn: () =>
      envelopeClient.get(
        `/admin/super/tenants?${buildQueryString(args)}`,
        TenantsListResponseSchema,
      ),
    staleTime: 15_000,
  });
}

export function useSuperAdminTenant(id: string) {
  return useQuery<TenantDetailResponse>({
    queryKey: superAdminTenantsKeys.detail(id),
    queryFn: () =>
      envelopeClient.get(
        `/admin/super/tenants/${id}`,
        TenantDetailResponseSchema,
      ),
    enabled: id.length > 0,
    staleTime: 15_000,
  });
}
