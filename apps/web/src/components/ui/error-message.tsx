'use client';

import { Button } from '@metanoia/ui';
import { resolveError } from '@/lib/errors/error-messages';
import messages from '../../../messages/pt-BR.json';

const t = messages.error;

export interface ErrorMessageProps {
  /**
   * The thrown error (ApiError, TypeError, generic Error).
   * Mutually exclusive with `errorKey`.
   */
  error?: unknown;
  /**
   * Override the resolved errorKey (e.g. "network.failed").
   * Used when the caller already knows what to display.
   */
  errorKey?: string;
  /**
   * Callback invoked when the user clicks the retry button.
   * If omitted, the retry button is hidden.
   */
  onRetry?: () => void;
  /**
   * Force-show the retry button even when the error is non-recoverable.
   */
  showRetry?: boolean;
  className?: string;
  testId?: string;
}

function lookupMessage(errorKey: string): string {
  const segments = errorKey.split('.');
  let cursor: unknown = t;
  for (const seg of segments) {
    if (typeof cursor !== 'object' || cursor === null) {
      return t.unknown.generic;
    }
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return typeof cursor === 'string' ? cursor : t.unknown.generic;
}

export function ErrorMessage({
  error,
  errorKey,
  onRetry,
  showRetry,
  className,
  testId = 'error-message',
}: ErrorMessageProps) {
  const message = errorKey
    ? lookupMessage(errorKey)
    : error !== undefined
      ? resolveError(error).message
      : t.unknown.generic;

  const shouldShowRetry = onRetry !== undefined && showRetry !== false;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid={testId}
      className={
        className ??
        'flex flex-col items-center gap-3 rounded-lg border border-[var(--color-border-default)] p-6 text-center'
      }
    >
      <p className="text-base text-text-primary">{message}</p>
      {shouldShowRetry && (
        <Button type="button" onClick={onRetry} variant="secondary">
          {t.network.retry}
        </Button>
      )}
    </div>
  );
}
