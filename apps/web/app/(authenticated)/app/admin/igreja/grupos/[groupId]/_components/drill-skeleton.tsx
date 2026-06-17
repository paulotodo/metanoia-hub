export function DrillSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="h-32 rounded-lg border border-border bg-surface p-6">
        <div className="mb-3 h-6 w-1/3 motion-safe:animate-pulse rounded bg-slate-200" />
        <div className="mb-2 h-4 w-1/2 motion-safe:animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-2/3 motion-safe:animate-pulse rounded bg-slate-200" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-lg border border-border bg-surface p-4"
          >
            <div className="mb-2 h-4 w-1/3 motion-safe:animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 motion-safe:animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
