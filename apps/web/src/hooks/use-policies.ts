'use client';

/**
 * Hooks for tenant policy toggles (Story 11-3).
 *
 * usePolicies()       — GET /api/v1/tenants/me/policies
 * useUpdatePolicies() — PATCH /api/v1/tenants/me/policies
 *
 * Constitution V: TanStack Query only in Client Components.
 * On mutation success: reads X-Policy-Version header; if it differs from the
 * cached version, invalidates the ['policies'] query.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PoliciesResponseSchema, type PoliciesResponse, type UpdatePoliciesDto } from '@metanoia/types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('accessToken');
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const policiesKeys = {
  all: ['policies'] as const,
  mine: () => [...policiesKeys.all, 'mine'] as const,
};

// ─── usePolicies ──────────────────────────────────────────────────────────────

/**
 * Fetches current tenant policy toggles.
 * Returns { policies, policyVersion, tierInfo } as PoliciesResponse.
 */
export function usePolicies() {
  return useQuery({
    queryKey: policiesKeys.mine(),
    queryFn: async (): Promise<PoliciesResponse> => {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/tenants/me/policies`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error(`Falha ao carregar políticas: ${response.status}`);
      }
      const json = (await response.json()) as { data: unknown };
      return PoliciesResponseSchema.parse(json.data);
    },
  });
}

// ─── useUpdatePolicies ────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/tenants/me/policies — partial update of policy toggles.
 *
 * After success: reads X-Policy-Version from response header;
 * if it differs from the currently cached version, invalidates the query.
 */
export function useUpdatePolicies() {
  const queryClient = useQueryClient();

  return useMutation<PoliciesResponse, Error, UpdatePoliciesDto>({
    mutationFn: async (dto: UpdatePoliciesDto): Promise<PoliciesResponse> => {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/tenants/me/policies`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dto),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
          details?: { upgradePrompt?: boolean };
        };
        throw new Error(body.message ?? 'Erro ao salvar políticas');
      }
      const json = (await response.json()) as { data: unknown };
      // Attach the server version to the result via policyVersion field (already in schema)
      const parsed = PoliciesResponseSchema.parse(json.data);

      // X-Policy-Version stale check: invalidate if version advanced
      const serverVersion = response.headers.get('X-Policy-Version');
      if (serverVersion) {
        const cached = queryClient.getQueryData<PoliciesResponse>(policiesKeys.mine());
        if (!cached || String(cached.policyVersion) !== serverVersion) {
          void queryClient.invalidateQueries({ queryKey: policiesKeys.all });
        }
      }

      return parsed;
    },
  });
}
