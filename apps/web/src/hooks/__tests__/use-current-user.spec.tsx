import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import { useCurrentUser } from '../use-current-user';
import { resetUserMockState } from '@test-mocks/handlers/users';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  resetUserMockState();
});

describe('useCurrentUser', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('returns user data after fetch', async () => {
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user).not.toBeNull();
      },
      { timeout: 5000 },
    );

    expect(result.current.user?.status).toBe('active');
    expect(result.current.user?.name).toBe('João Silva');
    expect(result.current.isError).toBe(false);
  });

  it('returns deletion_pending status when user is in grace period', async () => {
    server.use(
      http.get('http://localhost:3001/api/v1/users/me', () =>
        HttpResponse.json({
          data: {
            id: '01912345-6789-7000-8000-0000000000a1',
            email: 'joao@igrejabetania.com.br',
            name: 'João Silva',
            status: 'deletion_pending',
          },
        }),
      ),
    );

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user).not.toBeNull();
      },
      { timeout: 5000 },
    );
    expect(result.current.user?.status).toBe('deletion_pending');
  });

  it('sets isError on fetch failure', async () => {
    server.use(
      http.get('*/api/v1/users/me', () =>
        HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Unexpected error' },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.user).toBeNull();
  });
});
