'use client';

import messages from '../../../../../../messages/pt-BR.json';

const t = messages.trailPlaylist;

// ---------------------------------------------------------------------------
// TrailPlaylistEmpty — pastoral empty state when trail has no modules (FR-014)
// ---------------------------------------------------------------------------

export function TrailPlaylistEmpty() {
  return (
    <div
      className="flex flex-col items-center justify-center p-8 text-center gap-3"
      data-testid="trail-playlist-empty"
      role="status"
    >
      <p className="text-base font-semibold text-foreground">{t.empty.title}</p>
      <p className="text-sm text-muted-foreground max-w-[280px]">{t.empty.body}</p>
    </div>
  );
}
