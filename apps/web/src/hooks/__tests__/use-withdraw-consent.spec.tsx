/* eslint-disable @metanoia/no-surveillance-terms --
 * Test feeds the canonical `focus_monitoring` ConsentType enum value (the only
 * withdrawable consent type) to exercise the withdrawal mutation. No
 * user-facing surveillance vocabulary is introduced. */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useWithdrawConsent } from '../use-withdraw-consent';

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

describe('useWithdrawConsent', () => {
  it('succeeds for focus_monitoring (non-mandatory)', async () => {
    const { result } = renderHook(() => useWithdrawConsent(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ consentType: 'focus_monitoring' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('returns error (400) for terms_of_service (mandatory)', async () => {
    const { result } = renderHook(() => useWithdrawConsent(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ consentType: 'terms_of_service' });
    });

    await waitFor(() =>
      expect(result.current.isError || result.current.isSuccess).toBe(true),
    );
    // MSW handler returns 400 for terms_of_service → mutation should error
    expect(result.current.isError).toBe(true);
  });

  it('invalidates consent-history query on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useWithdrawConsent(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ consentType: 'focus_monitoring' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['consent-history'] }),
    );
  });
});
