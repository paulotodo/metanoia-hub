import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ContentTemplateSchema,
  TemplateListResponseSchema,
} from '@metanoia/types';
import type {
  ContentTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '@metanoia/types';
import { apiClient } from '../client';

export const templateKeys = {
  all: ['templates'] as const,
  list: (params?: Record<string, string>) => [...templateKeys.all, 'list', params] as const,
  detail: (id: string) => [...templateKeys.all, 'detail', id] as const,
  versions: (id: string) => [...templateKeys.all, 'versions', id] as const,
};

export interface TemplateListParams {
  page?: number;
  pageSize?: number;
  scope?: 'platform' | 'tenant';
  search?: string;
  sort?: 'name' | '-name' | 'createdAt' | '-createdAt';
}

export function useTemplatesList(params: TemplateListParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.scope) qs.set('scope', params.scope);
  if (params.search) qs.set('search', params.search);
  if (params.sort) qs.set('sort', params.sort);

  const query = qs.toString();
  return useQuery({
    queryKey: templateKeys.list(Object.fromEntries(qs.entries())),
    queryFn: () =>
      apiClient.getEnvelope(
        `/templates${query ? `?${query}` : ''}`,
        TemplateListResponseSchema,
      ),
    staleTime: 1000 * 30,
  });
}

export function useTemplateById(id: string) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: () => apiClient.get(`/templates/${id}`, ContentTemplateSchema),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });
}

export function useTemplateVersions(id: string, sourceTrailId: string | null) {
  return useQuery({
    queryKey: templateKeys.versions(id),
    queryFn: () =>
      apiClient.getEnvelope(
        `/templates/${id}/versions`,
        TemplateListResponseSchema,
      ),
    enabled: Boolean(id) && Boolean(sourceTrailId),
    staleTime: 1000 * 60,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTemplateRequest) =>
      apiClient.post('/templates', ContentTemplateSchema, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

export function useUpdateTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateTemplateRequest) =>
      apiClient.patch(`/templates/${id}`, ContentTemplateSchema, body),
    onSuccess: (updated: ContentTemplate) => {
      queryClient.setQueryData(templateKeys.detail(id), updated);
      void queryClient.invalidateQueries({ queryKey: templateKeys.list() });
    },
  });
}

export function useDeleteTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/templates/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}
