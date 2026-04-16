import { useQuery } from '@tanstack/react-query';
import {
  ChurchOverviewResponseSchema,
  type ChurchOverviewResponse,
} from '@metanoia/types';
import { ApiError } from '../client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('accessToken');
}

async function fetchEnvelope<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized', 'Sessão expirada');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      details?: unknown;
    };
    throw new ApiError(
      response.status,
      body.error ?? 'UnknownError',
      body.message ?? 'Erro inesperado',
      body.details,
    );
  }

  const json = (await response.json()) as unknown;
  return schema.parse(json);
}

export const pastoralAdminKeys = {
  all: ['pastoral-admin'] as const,
  overview: () => [...pastoralAdminKeys.all, 'overview'] as const,
};

export function useGroupsAggregated() {
  return useQuery<ChurchOverviewResponse>({
    queryKey: pastoralAdminKeys.overview(),
    queryFn: () =>
      fetchEnvelope('/admin/church/overview', ChurchOverviewResponseSchema),
  });
}
