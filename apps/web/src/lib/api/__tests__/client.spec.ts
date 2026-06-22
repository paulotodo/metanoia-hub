import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../mocks/server';
import { apiClient, ApiError } from '../client';

// Structural schema (matches Zod's .parse interface without importing zod)
const TestSchema = {
  parse: (data: unknown) => {
    const obj = data as { id: string; name: string };
    if (typeof obj.id !== 'string' || typeof obj.name !== 'string') {
      throw new Error('Validation failed');
    }
    return obj;
  },
};

describe('apiClient', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('unwraps { data } envelope and validates with Zod', async () => {
    server.use(
      http.get('*/api/v1/test', () =>
        HttpResponse.json({ data: { id: '1', name: 'Test' } }),
      ),
    );

    const result = await apiClient.get('/test', TestSchema);
    expect(result).toEqual({ id: '1', name: 'Test' });
  });

  it('sends requests with cache: no-store (avoids 304 revalidation loop)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    server.use(
      http.get('*/api/v1/test', () =>
        HttpResponse.json({ data: { id: '1', name: 'Test' } }),
      ),
    );

    await apiClient.get('/test', TestSchema);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    fetchSpy.mockRestore();
  });

  it('attaches Authorization header when token exists', async () => {
    sessionStorage.setItem('accessToken', 'test-token-123');

    server.use(
      http.get('*/api/v1/test', ({ request }) => {
        const auth = request.headers.get('Authorization');
        return HttpResponse.json({
          data: { id: '1', name: auth ?? 'no-auth' },
        });
      }),
    );

    const result = await apiClient.get('/test', TestSchema);
    expect(result.name).toBe('Bearer test-token-123');
  });

  it('throws ApiError on non-2xx response', async () => {
    server.use(
      http.get('*/api/v1/test', () =>
        HttpResponse.json(
          { error: 'NotFound', message: 'Resource not found' },
          { status: 404 },
        ),
      ),
    );

    await expect(apiClient.get('/test', TestSchema)).rejects.toThrow(ApiError);
    await expect(apiClient.get('/test', TestSchema)).rejects.toMatchObject({
      statusCode: 404,
      error: 'NotFound',
      message: 'Resource not found',
    });
  });

  it('throws on Zod validation failure', async () => {
    server.use(
      http.get('*/api/v1/test', () =>
        HttpResponse.json({ data: { id: 123, name: null } }), // wrong types
      ),
    );

    await expect(apiClient.get('/test', TestSchema)).rejects.toThrow();
  });

  it('clears session and redirects on 401', async () => {
    sessionStorage.setItem('accessToken', 'expired-token');

    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '', set href(v: string) { hrefSetter(v); } },
      writable: true,
      configurable: true,
    });

    server.use(
      http.get('*/api/v1/test', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      ),
    );

    await expect(apiClient.get('/test', TestSchema)).rejects.toThrow(ApiError);
    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });

  it('posts body as JSON', async () => {
    const ResponseSchema = {
      parse: (data: unknown) => data as { created: boolean },
    };

    server.use(
      http.post('*/api/v1/test', async ({ request }) => {
        const body = (await request.json()) as { value: string };
        return HttpResponse.json(
          { data: { created: body.value === 'hello' } },
          { status: 201 },
        );
      }),
    );

    const result = await apiClient.post('/test', ResponseSchema, {
      value: 'hello',
    });
    expect(result).toEqual({ created: true });
  });
});
