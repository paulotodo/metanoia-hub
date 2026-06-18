'use client';

import { useState } from 'react';
import messages from '../../../../../../../messages/pt-BR.json';
import { useTenantRefresh } from '../../../../../../../src/lib/api/hooks/use-tenant-report';

const t = messages.tenantReport.refresh;

/**
 * "Atualizar agora" — dispara refresh on-demand da MV (rate-limited 1/5min).
 * Trata 429 exibindo mensagem com retryAfter. aria-busy durante a requisição.
 */
export function RefreshButton() {
  const refresh = useTenantRefresh();
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleClick() {
    setFeedback(null);
    refresh.mutate(undefined, {
      onSuccess: (result) => {
        if (result.accepted) {
          setFeedback(t.accepted);
        } else {
          const seconds = result.retryAfter ?? 300;
          setFeedback(t.rateLimited.replace('{seconds}', String(seconds)));
        }
      },
      onError: () => setFeedback(t.error),
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={refresh.isPending}
        aria-busy={refresh.isPending}
        aria-label={t.ariaLabel}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refresh.isPending ? t.pending : t.label}
      </button>
      {feedback !== null && (
        <p role="status" aria-live="polite" className="text-xs text-text-secondary">
          {feedback}
        </p>
      )}
    </div>
  );
}
