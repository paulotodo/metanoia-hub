import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import { usePrivacyExport } from '../use-privacy-export';
import { resetPrivacyMockState } from '@test-mocks/handlers/privacy';

const MOCK_JOB_ID = '0199a000-0000-7000-8000-000000000001';
const MOCK_SIGNED_URL =
  'https://minio.example.com/exports/global/0199a000-data.json?X-Amz-Expires=172800';

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
  resetPrivacyMockState();
});

describe('usePrivacyExport', () => {
  it('starts with null jobId, status and signedUrl', () => {
    const { result } = renderHook(() => usePrivacyExport(), {
      wrapper: createWrapper(),
    });

    expect(result.current.jobId).toBeNull();
    expect(result.current.status).toBeNull();
    expect(result.current.signedUrl).toBeNull();
    expect(result.current.isPolling).toBe(false);
  });

  it('requestExport sets jobId after successful POST', async () => {
    const { result } = renderHook(() => usePrivacyExport(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestExport('json');
    });

    await waitFor(() => expect(result.current.jobId).toBe(MOCK_JOB_ID));
    expect(result.current.isPolling).toBe(true);
  });

  it('polls and eventually reaches completed with signedUrl', async () => {
    // Override to skip intermediate states — jump straight to completed
    server.use(
      http.post('*/api/v1/privacy/export', () => {
        return HttpResponse.json(
          {
            data: {
              jobId: MOCK_JOB_ID,
              status: 'accepted',
              estimatedCompletionHours: 24,
            },
          },
          { status: 202 },
        );
      }),
      http.get('*/api/v1/privacy/export/:jobId', () => {
        return HttpResponse.json({
          data: {
            jobId: MOCK_JOB_ID,
            status: 'completed',
            signedUrl: MOCK_SIGNED_URL,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            failureReason: null,
          },
        });
      }),
    );

    const { result } = renderHook(() => usePrivacyExport(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestExport('json');
    });

    await waitFor(() => expect(result.current.jobId).toBe(MOCK_JOB_ID), { timeout: 5_000 });
    await waitFor(() => expect(result.current.status).toBe('completed'), { timeout: 15_000 });
    expect(result.current.signedUrl).toBe(MOCK_SIGNED_URL);
    expect(result.current.isPolling).toBe(false);
  }, 20_000);

  it('sets isDuplicateError true on 409 response', async () => {
    // Override handler to always return 409
    server.use(
      http.post('*/api/v1/privacy/export', () => {
        return HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'Export already in progress' },
          { status: 409 },
        );
      }),
    );

    const { result } = renderHook(() => usePrivacyExport(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestExport('json');
    });

    await waitFor(() => expect(result.current.isDuplicateError).toBe(true));
    expect(result.current.jobId).toBeNull();
  });
});
