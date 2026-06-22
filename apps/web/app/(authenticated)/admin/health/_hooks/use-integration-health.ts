'use client';

import { useQuery } from '@tanstack/react-query';
import {
  IntegrationHealthResponseSchema,
  type IntegrationHealthResponse,
  type IntegrationHealthHistoryResponse,
} from '@metanoia/types';
import { envelopeClient } from '@/lib/api/envelope';

// ---------------------------------------------------------------------------
// Story 14-4 §FR-010 — Hooks TanStack Query para health check de integrações.
// Client Components ONLY (CLAUDE.md: TanStack Query nunca em Server Components).
// ---------------------------------------------------------------------------

export const integrationHealthKeys = {
  all: ['integration-health'] as const,
  list: () => [...integrationHealthKeys.all, 'list'] as const,
  history: (integration: string, hours?: number) =>
    [...integrationHealthKeys.all, 'history', integration, hours ?? 24] as const,
};

/**
 * useIntegrationHealth — busca status atual das 5 integrações.
 * refetchInterval: 60s; staleTime: 55s (auto-refresh conforme §FR-010).
 * Parseia resposta com IntegrationHealthResponseSchema (validação Zod no frontend).
 */
export function useIntegrationHealth() {
  return useQuery<IntegrationHealthResponse>({
    queryKey: integrationHealthKeys.list(),
    queryFn: () =>
      envelopeClient.get('/admin/health/integrations', IntegrationHealthResponseSchema),
    staleTime: 55_000,
    refetchInterval: 60_000,
  });
}

/**
 * useIntegrationHistory — busca histórico de latência para sparkline 24h.
 * Disparado apenas quando integrationName é fornecido (enabled: !!integrationName).
 */
export function useIntegrationHistory(integrationName: string, hours = 24) {
  return useQuery<IntegrationHealthHistoryResponse>({
    queryKey: integrationHealthKeys.history(integrationName, hours),
    queryFn: async () => {
      const params = new URLSearchParams({ integration: integrationName, hours: String(hours) });
      const resp = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/admin/health/integrations/history?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') ?? '' : ''}`,
          },
        },
      );
      if (!resp.ok) throw new Error(`History fetch failed: ${resp.status}`);
      return resp.json() as Promise<IntegrationHealthHistoryResponse>;
    },
    enabled: !!integrationName,
    staleTime: 55_000,
  });
}
