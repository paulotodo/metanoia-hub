/**
 * TrailPlaylistSkeleton — loading placeholder for TrailPlaylist.
 *
 * Uses fixed dimensions matching the real component to prevent CLS (FR-007, FR-008).
 * motion-safe:animate-pulse wrapped in motion-safe: so it respects prefers-reduced-motion.
 */

// Not a Client Component — no interactivity; pure static markup.

const MODULE_COUNT = 3;
const LESSONS_PER_MODULE = 3;

export function TrailPlaylistSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" role="status" aria-label="Carregando trilha" data-testid="trail-playlist-skeleton">
      {/* Header skeleton — fixed height 72px matching TrailPlaylistHeader */}
      <div className="h-[72px] bg-muted motion-safe:animate-pulse rounded-xl" />

      {/* Module skeletons */}
      {Array.from({ length: MODULE_COUNT }).map((_, mi) => (
        <div key={mi} className="border rounded-xl overflow-hidden">
          {/* Module header — min-h-11 matching accordion header */}
          <div className="h-[72px] bg-muted motion-safe:animate-pulse" />

          {/* Lesson rows — min-h-11 per row */}
          <div className="divide-y divide-border">
            {Array.from({ length: LESSONS_PER_MODULE }).map((_, li) => (
              <div
                key={li}
                className="h-11 mx-3 my-2 bg-muted motion-safe:animate-pulse rounded-xl"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
