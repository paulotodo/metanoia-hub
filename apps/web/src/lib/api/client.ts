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
  opts: { unwrap?: boolean } = { unwrap: true },
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    // 'no-store' impede a revalidação condicional (If-None-Match) que faz a API
    // responder 304 sem corpo. Um 304 cairia no `if (!response.ok)` abaixo
    // (response.ok é false para 304) e seria lançado como ApiError, quebrando a
    // query e disparando re-render em loop. O cache de dados é do React Query.
    cache: 'no-store',
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

  const json = await response.json();
  if (opts.unwrap === false) {
    return schema.parse(json);
  }
  return schema.parse((json as { data: unknown }).data);
}

export const apiClient = {
  get: <T>(path: string, schema: Schema<T>) =>
    request(path, schema, { method: 'GET' }),

  /** GET that parses the full `{ data, meta }` envelope instead of just `data`. */
  getEnvelope: <T>(path: string, schema: Schema<T>) =>
    request(path, schema, { method: 'GET' }, { unwrap: false }),

  post: <T>(path: string, schema: Schema<T>, body: unknown) =>
    request(path, schema, { method: 'POST', body }),

  patch: <T>(path: string, schema: Schema<T>, body: unknown) =>
    request(path, schema, { method: 'PATCH', body }),

  delete: (path: string) =>
    request(path, { parse: () => undefined as unknown }, { method: 'DELETE' }),
};
