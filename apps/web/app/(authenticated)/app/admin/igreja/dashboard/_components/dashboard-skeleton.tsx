export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 animate-pulse">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 w-72 rounded bg-bg-secondary" />
        <div className="mt-2 h-4 w-48 rounded bg-bg-secondary" />
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-lg bg-bg-secondary" />
        ))}
      </div>

      {/* Distribution by group */}
      <div className="h-6 w-32 rounded bg-bg-secondary mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-bg-secondary" />
        ))}
      </div>
    </div>
  );
}
