'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@metanoia/ui';
import { reportError } from '@/lib/observability/report-error';
import messages from '../../../messages/pt-BR.json';

const t = messages.error.boundary;

export interface BoundaryFallbackProps {
  /**
   * Error caught by the boundary. May include `digest` (server-rendered
   * production errors) and `cause` (chained originals).
   */
  error: Error & { digest?: string };
  /**
   * Re-renders the boundary's tree, retrying the failed render.
   * Provided by Next.js App Router error.tsx convention.
   */
  reset: () => void;
  /**
   * Route identifier (e.g. "(authenticated)") so Sentry can group reports.
   */
  route?: string;
  /**
   * Whether to render `<html>`/`<body>` tags (only the global-error.tsx
   * boundary needs them — root layout is replaced when this fires).
   */
  withRootShell?: boolean;
}

export function BoundaryFallback({
  error,
  reset,
  route,
  withRootShell = false,
}: BoundaryFallbackProps) {
  // React 19 StrictMode runs effects twice in dev — without this guard the
  // boundary would fire two beacons per crash and pollute Sentry.
  const reportedRef = useRef<Error | null>(null);
  useEffect(() => {
    if (reportedRef.current === error) return;
    reportedRef.current = error;
    reportError(error, {
      route: route ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
      digest: error.digest,
    });
  }, [error, route]);

  const content = (
    <main
      role="alert"
      aria-live="assertive"
      data-testid="boundary-fallback"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h1 className="text-2xl font-semibold text-text-primary md:text-3xl">
        {t.title}
      </h1>
      <p className="text-text-muted max-w-md text-base">
        {t.description}
      </p>
      <div className="flex gap-3">
        <Button type="button" onClick={reset}>
          {t.retry}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
        >
          {t.home}
        </Button>
      </div>
    </main>
  );

  if (withRootShell) {
    return (
      <html lang="pt-BR">
        <body className="bg-surface-base text-text-primary font-sans antialiased">
          {content}
        </body>
      </html>
    );
  }

  return content;
}
