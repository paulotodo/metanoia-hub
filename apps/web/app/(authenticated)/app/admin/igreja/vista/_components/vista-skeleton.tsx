export function VistaSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando grupos"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-36 rounded-lg border border-border bg-surface p-5"
        >
          <div className="mb-3 h-5 w-2/3 motion-safe:animate-pulse rounded bg-slate-200" />
          <div className="mb-4 h-4 w-1/2 motion-safe:animate-pulse rounded bg-slate-200" />
          <div className="mb-1 h-3 w-3/4 motion-safe:animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-2/3 motion-safe:animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}
