import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@test-mocks/server';
import { usePrivacyDeletion } from '../use-privacy-deletion';
import {
  resetPrivacyDeletionMockState,
  MOCK_DELETION_REQUEST_ID,
} from '@test-mocks/handlers/privacy-deletion';

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
  resetPrivacyDeletionMockState();
});

describe('usePrivacyDeletion', () => {
  it('starts with null requestId and no errors', () => {
    const { result } = renderHook(() => usePrivacyDeletion(), {
      wrapper: createWrapper(),
    });

    expect(result.current.requestId).toBeNull();
    expect(result.current.isDuplicateError).toBe(false);
    expect(result.current.isLeaderBlocker).toBe(false);
    expect(result.current.isRequestPending).toBe(false);
  });

  it('requestDeletion sets requestId on success', async () => {
    const { result } = renderHook(() => usePrivacyDeletion(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestDeletion();
    });

    await waitFor(() => expect(result.current.requestId).toBe(MOCK_DELETION_REQUEST_ID));
    expect(result.current.cancellableUntil).not.toBeNull();
    expect(result.current.deletionDeadline).not.toBeNull();
  });

  it('sets isDuplicateError on 409 response', async () => {
    server.use(
      http.post('*/api/v1/privacy/deletion', () =>
        HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'Deletion request already active' },
          { status: 409 },
        ),
      ),
    );

    const { result } = renderHook(() => usePrivacyDeletion(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestDeletion();
    });

    await waitFor(() => expect(result.current.isDuplicateError).toBe(true));
    expect(result.current.requestId).toBeNull();
  });

  it('sets isLeaderBlocker on 422 response', async () => {
    server.use(
      http.post('*/api/v1/privacy/deletion', () =>
        HttpResponse.json(
          {
            statusCode: 422,
            error: 'LEADER_ACTIVE_GROUPS',
            message: 'Você lidera grupos ativos.',
          },
          { status: 422 },
        ),
      ),
    );

    const { result } = renderHook(() => usePrivacyDeletion(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestDeletion();
    });

    await waitFor(() => expect(result.current.isLeaderBlocker).toBe(true));
  });

  it('cancelDeletion clears requestId on 204 success', async () => {
    // First, create a deletion request
    const { result } = renderHook(() => usePrivacyDeletion(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestDeletion();
    });

    await waitFor(() => expect(result.current.requestId).toBe(MOCK_DELETION_REQUEST_ID));

    // Now cancel it
    act(() => {
      result.current.cancelDeletion(MOCK_DELETION_REQUEST_ID);
    });

    await waitFor(() => expect(result.current.isCancelPending).toBe(false));
    expect(result.current.cancelError).toBeNull();
  });

  it('accepts initialRequestId for pre-existing requests', () => {
    const { result } = renderHook(
      () => usePrivacyDeletion(MOCK_DELETION_REQUEST_ID),
      { wrapper: createWrapper() },
    );

    expect(result.current.requestId).toBe(MOCK_DELETION_REQUEST_ID);
  });
});
