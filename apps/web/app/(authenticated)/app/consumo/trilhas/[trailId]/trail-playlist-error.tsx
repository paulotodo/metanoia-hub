'use client';

import messages from '../../../../../../messages/pt-BR.json';

const t = messages.trailPlaylist;

// ---------------------------------------------------------------------------
// TrailPlaylistError — error boundary inline with retry action
// ---------------------------------------------------------------------------

interface TrailPlaylistErrorProps {
  onRetry: () => void;
}

export function TrailPlaylistError({ onRetry }: TrailPlaylistErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center p-8 text-center gap-4"
      data-testid="trail-playlist-error"
      role="alert"
    >
      <p className="text-sm text-destructive">{t.error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center min-h-11 min-w-11 px-4 py-2 text-sm font-medium rounded-xl border border-border bg-card hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        data-testid="trail-playlist-retry"
      >
        {t.retry}
      </button>
    </div>
  );
}
