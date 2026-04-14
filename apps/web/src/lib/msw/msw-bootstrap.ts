let started: Promise<void> | null = null;

export function startMswWorker(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (process.env.NEXT_PUBLIC_API_MOCKING !== 'enabled') return Promise.resolve();
  if (started) return started;

  started = import('../../../mocks/browser').then(async ({ worker }) => {
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    });
  });

  return started;
}
