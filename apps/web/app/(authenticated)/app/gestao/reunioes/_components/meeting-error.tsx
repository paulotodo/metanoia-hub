"use client";

import { ApiError } from "@/lib/api";

export function MeetingError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError
      ? error.message
      : "Não conseguimos carregar a agenda.";

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-lg border border-care-urgent/30 bg-care-urgent/5 px-6 py-8 text-center"
    >
      <p className="text-sm text-care-urgent">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-brand-teal px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
