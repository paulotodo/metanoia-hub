import { ApiError } from './client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface Schema<T> {
  parse: (data: unknown) => T;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('accessToken');
}

async function request<T>(
  path: string,
  options: RequestInit,
  schema?: Schema<T>,
): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
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

  if (response.status === 204 || !schema) {
    return undefined as T;
  }

  const json = (await response.json()) as unknown;
  return schema.parse(json);
}

export const envelopeClient = {
  get: <T>(path: string, schema: Schema<T>) =>
    request(path, { method: 'GET' }, schema),

  post: <T>(path: string, body: unknown, schema: Schema<T>) =>
    request(path, { method: 'POST', body: JSON.stringify(body) }, schema),

  put: <T>(path: string, body: unknown, schema: Schema<T>) =>
    request(path, { method: 'PUT', body: JSON.stringify(body) }, schema),

  delete: (path: string): Promise<void> =>
    request(path, { method: 'DELETE' }) as Promise<void>,
};
