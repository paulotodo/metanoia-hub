'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { startMswWorker } from '../msw/msw-bootstrap';
import { exponentialRetryDelay, shouldRetryQuery } from './retry-policy';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: shouldRetryQuery,
        retryDelay: exponentialRetryDelay,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function AppQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
  const [mswReady, setMswReady] = useState(!mockingEnabled);

  useEffect(() => {
    if (!mockingEnabled) return;
    startMswWorker().then(() => setMswReady(true));
  }, [mockingEnabled]);

  if (!mswReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
