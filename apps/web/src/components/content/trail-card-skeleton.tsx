/**
 * TrailCardSkeleton — placeholder while trails are loading.
 * Fixed dimensions to prevent Cumulative Layout Shift (CLS).
 * Uses motion-safe:animate-pulse per project standard (UX-DR27).
 */
export function TrailCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando trilha..."
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 h-[168px]"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="h-5 w-3/5 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-5 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
      {/* Description lines */}
      <div className="flex flex-col gap-1.5">
        <div className="h-3.5 w-full rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-3.5 w-4/5 rounded bg-muted motion-safe:animate-pulse" />
      </div>
      {/* Meta row */}
      <div className="flex gap-4">
        <div className="h-3 w-16 rounded bg-muted motion-safe:animate-pulse" />
        <div className="h-3 w-12 rounded bg-muted motion-safe:animate-pulse" />
      </div>
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-muted motion-safe:animate-pulse" />
        <div className="h-3 w-8 rounded bg-muted motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

/**
 * TrailCardSkeletonList — renders N skeleton cards (default: 3).
 */
export function TrailCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-4" aria-label="Carregando trilhas...">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <TrailCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
