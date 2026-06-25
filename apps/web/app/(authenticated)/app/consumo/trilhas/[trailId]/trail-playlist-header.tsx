'use client';

import { TrailProgressBar } from '@/components/content/trail-progress-bar';
import { useTrailProgress } from '@/lib/api/hooks/use-progress';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.trailPlaylist;

// ---------------------------------------------------------------------------
// TrailPlaylistHeader — overall trail progress bar (FR-006)
// ---------------------------------------------------------------------------

interface TrailPlaylistHeaderProps {
  trailId: string;
}

export function TrailPlaylistHeader({ trailId }: TrailPlaylistHeaderProps) {
  const { data: progressData, isLoading } = useTrailProgress(trailId);

  // Fixed height for CLS=0 (FR-007) — same height whether loading or loaded
  return (
    <div className="px-5 pt-5 pb-4 border-b bg-card min-h-[72px] flex flex-col justify-center" data-testid="trail-playlist-header">
      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
        {t.overallProgress}
      </p>
      {isLoading ? (
        <div className="h-4 bg-muted motion-safe:animate-pulse rounded-full" aria-busy="true" />
      ) : (
        <TrailProgressBar
          progressPercent={progressData?.data.progressPercent ?? 0}
          label={`Progresso na trilha: ${progressData?.data.progressPercent ?? 0}%`}
        />
      )}
    </div>
  );
}
