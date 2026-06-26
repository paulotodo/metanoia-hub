'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@metanoia/ui';
import { TrailPlaylist } from './trail-playlist';

// ---------------------------------------------------------------------------
// TrailPlaylistRoute — responsive wrapper: aside on desktop, bottom-sheet on mobile
// Ref: spec §FR-002 | plan.md §2 Layout switch | CHK015 + CHK030 resolutions
// ---------------------------------------------------------------------------

interface TrailPlaylistRouteProps {
  trailId: string;
}

export function TrailPlaylistRoute({ trailId }: TrailPlaylistRouteProps) {
  const router = useRouter();

  const handleLessonSelect = (lessonId: string, moduleId?: string) => {
    const qs = moduleId ? `?moduleId=${moduleId}` : '';
    router.push(`/app/consumo/trilhas/${trailId}/aulas/${lessonId}${qs}`);
  };

  return (
    <>
      {/* Desktop: fixed aside panel (md+) */}
      <aside
        className="hidden md:flex md:flex-col md:w-80 lg:w-96 fixed right-0 top-0 h-full overflow-y-auto border-l bg-background z-10"
        aria-label="Painel de aulas da trilha"
      >
        <TrailPlaylist trailId={trailId} onLessonSelect={handleLessonSelect} />
      </aside>

      {/* Mobile: bottom-sheet via Radix Dialog (CHK015 resolution: defaultOpen={false}) */}
      <div className="block md:hidden">
        <Dialog defaultOpen={false}>
          <DialogContent
            className="fixed bottom-0 left-0 right-0 h-[60vh] w-full rounded-t-2xl p-0 flex flex-col motion-safe:slide-in-from-bottom"
            // touch-action + overflow-y: isolate scroll from page scroll (CHK030/iOS Safari)
            style={{ touchAction: 'pan-y', overflowY: 'auto' }}
            aria-describedby={undefined}
          >
            {/* Handle visual — aria-hidden as it is decorative */}
            <div
              className="h-1 w-10 rounded-full bg-muted mx-auto mt-2 mb-4 shrink-0"
              aria-hidden="true"
            />
            <DialogTitle className="sr-only">Aulas da trilha</DialogTitle>
            <div className="flex-1 overflow-y-auto">
              <TrailPlaylist trailId={trailId} onLessonSelect={handleLessonSelect} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
