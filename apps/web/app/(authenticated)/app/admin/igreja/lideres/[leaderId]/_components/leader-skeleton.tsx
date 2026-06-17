export function LeaderSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="h-24 rounded-lg border border-border bg-surface p-6">
        <div className="mb-2 h-6 w-1/3 motion-safe:animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-1/2 motion-safe:animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-32 rounded-lg border border-border bg-surface p-5">
        <div className="mb-2 h-4 w-1/3 motion-safe:animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-full motion-safe:animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-40 rounded-lg border border-border bg-surface p-5">
        <div className="mb-3 h-4 w-1/2 motion-safe:animate-pulse rounded bg-slate-200" />
        <div className="space-y-2">
          <div className="h-3 w-full motion-safe:animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-5/6 motion-safe:animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-4/6 motion-safe:animate-pulse rounded bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
