interface Schema<T> {
  parse: (data: unknown) => T;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('accessToken');
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function request<T>(
  path: string,
  schema: Schema<T>,
  options: RequestOptions = {},
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized', 'Sessão expirada');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      (body as { error?: string }).error ?? 'UnknownError',
      (body as { message?: string }).message ?? 'Erro inesperado',
      (body as { details?: unknown }).details,
    );
  }

  // 204 No Content (e.g. DELETE) — no body to parse
  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as { data: unknown };
  return schema.parse(json.data);
}

export const apiClient = {
  get: <T>(path: string, schema: Schema<T>) =>
    request(path, schema, { method: 'GET' }),

  post: <T>(path: string, schema: Schema<T>, body: unknown) =>
    request(path, schema, { method: 'POST', body }),
};
