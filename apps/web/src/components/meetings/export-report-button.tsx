'use client';

import * as React from 'react';
import messages from '@/../messages/pt-BR.json';

export interface ExportReportButtonProps {
  meetingId: string;
}

type ExportState =
  | { phase: 'idle' }
  | { phase: 'enqueuing' }
  | { phase: 'polling'; jobId: string; attempts: number }
  | { phase: 'done'; signedUrl: string }
  | { phase: 'error'; message: string };

const t = messages.meetingLeaderReport.export;

/**
 * ExportReportButton — asynchronous CSV export for meeting attendance (FR-06).
 *
 * Polling cadence per CHK040:
 *   - Minimum interval: 3 seconds (respects Retry-After header)
 *   - Backoff: 3s → 6s → 12s → max 30s
 *   - Max 20 attempts; after limit, shows timeout error message
 *
 * Accessibility (a11y):
 *   - Progress indicator: role="status" + aria-live="polite" (non-intrusive)
 *   - Error message: role="alert" (immediate announcement)
 *   - Download link with explicit "Baixar CSV" text label
 */
export function ExportReportButton({ meetingId }: ExportReportButtonProps) {
  const [state, setState] = React.useState<ExportState>({ phase: 'idle' });
  const abortRef = React.useRef<AbortController | null>(null);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function startExport() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ phase: 'enqueuing' });

    try {
      const res = await fetch(`/api/v1/meetings/${meetingId}/report/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Export request failed: ${res.status}`);
      }

      const body = (await res.json()) as { data: { jobId: string } };
      const jobId = body.data.jobId;

      setState({ phase: 'polling', jobId, attempts: 0 });
      void pollStatus(jobId, 0, controller);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState({ phase: 'error', message: t.error });
    }
  }

  async function pollStatus(
    jobId: string,
    attempt: number,
    controller: AbortController,
  ): Promise<void> {
    const MAX_ATTEMPTS = 20;

    if (attempt >= MAX_ATTEMPTS) {
      setState({ phase: 'error', message: t.timeout });
      return;
    }

    // Exponential backoff: 3s → 6s → 12s → max 30s (CHK040)
    const baseDelay = 3000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000);

    await new Promise<void>((resolve) => setTimeout(resolve, delay));

    if (controller.signal.aborted) return;

    try {
      const res = await fetch(`/api/v1/reports/jobs/${jobId}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Polling failed: ${res.status}`);
      }

      // Respect Retry-After header (CHK040)
      const retryAfterHeader = res.headers.get('Retry-After');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

      const body = (await res.json()) as {
        data: {
          status: 'processing' | 'completed' | 'failed';
          signedUrl: string | null;
          failureReason: string | null;
        };
      };

      if (body.data.status === 'completed' && body.data.signedUrl) {
        setState({ phase: 'done', signedUrl: body.data.signedUrl });
        return;
      }

      if (body.data.status === 'failed') {
        setState({ phase: 'error', message: t.error });
        return;
      }

      // Still processing — update attempt count and schedule next poll
      setState((prev) =>
        prev.phase === 'polling' ? { ...prev, attempts: attempt + 1 } : prev,
      );

      // If server requested longer delay, honour it
      const nextDelay =
        retryAfterSeconds !== null ? retryAfterSeconds * 1000 : undefined;
      if (nextDelay !== undefined) {
        await new Promise<void>((resolve) => setTimeout(resolve, nextDelay));
        if (controller.signal.aborted) return;
      }

      void pollStatus(jobId, attempt + 1, controller);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState({ phase: 'error', message: t.error });
    }
  }

  if (state.phase === 'done') {
    return (
      <a
        href={state.signedUrl}
        download
        className="inline-flex items-center gap-1 rounded-md bg-engagement-high px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {/* Icon: Download */}
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {t.download}
      </a>
    );
  }

  if (state.phase === 'error') {
    return (
      <div>
        <p
          role="alert"
          className="mb-2 text-sm text-care-alert"
        >
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => void startExport()}
          className="inline-flex items-center gap-1 rounded-md border border-border-default px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
        >
          {t.button}
        </button>
      </div>
    );
  }

  if (state.phase === 'polling' || state.phase === 'enqueuing') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={t.processing}
        className="inline-flex items-center gap-2 text-sm text-text-secondary"
      >
        {/* Accessible spinner */}
        <svg
          aria-hidden="true"
          className="h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>{t.processing}</span>
      </div>
    );
  }

  // idle
  return (
    <button
      type="button"
      onClick={() => void startExport()}
      className="inline-flex items-center gap-1 rounded-md border border-border-default px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {/* Icon: Export/CSV */}
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        />
      </svg>
      {t.button}
    </button>
  );
}
