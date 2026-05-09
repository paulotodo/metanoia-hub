'use client';

import { ErrorMessage } from './error-message';
import messages from '../../../messages/pt-BR.json';

const t = messages.error.network;

export interface NetworkErrorStateProps {
  /**
   * The query/mutation error to display.
   * If omitted, falls back to the generic network message.
   */
  error?: unknown;
  /**
   * Callback to refetch / retry the failed request.
   */
  onRetry: () => void;
  /**
   * Whether the request is currently being retried (skeleton state).
   * When true, renders the skeleton instead of the error.
   */
  isRetrying?: boolean;
  /**
   * Optional skeleton element to render during retry.
   * Defaults to a 3-line shimmer.
   */
  skeleton?: React.ReactNode;
  className?: string;
  testId?: string;
}

function DefaultSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t.retrying}
      data-testid="network-error-skeleton"
      className="flex flex-col gap-3"
    >
      <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-border-default)]" />
      <div className="h-4 w-full animate-pulse rounded bg-[var(--color-border-default)]" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--color-border-default)]" />
    </div>
  );
}

/**
 * Renders a skeleton while the query is retrying (TanStack Query handles
 * exponential backoff via {@link RETRY_POLICY}); after retries are exhausted,
 * shows the friendly fallback message with a retry button.
 *
 * Drop-in replacement for `{isLoading ? <Skeleton /> : null}` blocks where
 * the caller wants resilient retry semantics.
 */
export function NetworkErrorState({
  error,
  onRetry,
  isRetrying = false,
  skeleton,
  className,
  testId = 'network-error-state',
}: NetworkErrorStateProps) {
  if (isRetrying) {
    return <div data-testid={testId}>{skeleton ?? <DefaultSkeleton />}</div>;
  }

  return (
    <ErrorMessage
      error={error}
      errorKey={error == null ? 'network.failed' : undefined}
      onRetry={onRetry}
      className={className}
      testId={testId}
    />
  );
}
