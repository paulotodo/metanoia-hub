import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useConsentHistory } from '../use-consent-history';

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

describe('useConsentHistory', () => {
  it('fetches and returns validated consent history', async () => {
    const { result } = renderHook(() => useConsentHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.data).toBeInstanceOf(Array);
    // MSW handler returns 3 items (terms_of_service, privacy_policy, focus_monitoring)
    expect(data?.data.length).toBeGreaterThan(0);
  });

  it('returns items with expected shape (consentType + status + isMandatory)', async () => {
    const { result } = renderHook(() => useConsentHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const items = result.current.data?.data ?? [];
    for (const item of items) {
      expect(item.consentType).toBeDefined();
      expect(['accepted', 'withdrawn', 'pending']).toContain(item.status);
      expect(typeof item.isMandatory).toBe('boolean');
    }
  });

  it('marks terms_of_service and privacy_policy as mandatory', async () => {
    const { result } = renderHook(() => useConsentHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const items = result.current.data?.data ?? [];
    const terms = items.find((i) => i.consentType === 'terms_of_service');
    const privacy = items.find((i) => i.consentType === 'privacy_policy');

    if (terms) expect(terms.isMandatory).toBe(true);
    if (privacy) expect(privacy.isMandatory).toBe(true);
  });
});
