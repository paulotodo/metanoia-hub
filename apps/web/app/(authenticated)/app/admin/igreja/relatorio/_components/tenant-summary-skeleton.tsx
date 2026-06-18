import messages from '../../../../../../../messages/pt-BR.json';

const t = messages.tenantReport;

/** Loading placeholder for the tenant summary dashboard. */
export function TenantSummarySkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t.loading}</span>
      <div className="mb-6 h-8 w-64 animate-pulse rounded bg-surface-muted" />
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
