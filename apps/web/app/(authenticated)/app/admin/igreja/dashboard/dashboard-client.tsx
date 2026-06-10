'use client';

import messages from '../../../../../../messages/pt-BR.json';
import { useRadarDashboard } from '../../../../../../src/lib/api/hooks/use-radar';
import { StatusSummaryCard } from './_components/status-summary-card';
import { GroupDistributionRow } from './_components/group-distribution-row';
import { TrendBadge } from './_components/trend-badge';
import { DashboardSkeleton } from './_components/dashboard-skeleton';

const t = messages.dashboard;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DashboardClient() {
  const query = useRadarDashboard();

  if (query.isPending) {
    return <DashboardSkeleton />;
  }

  if (query.isError) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-text-danger" role="alert">
          {t.error.loading}
        </p>
        <button
          type="button"
          className="mt-4 text-sm underline"
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </button>
      </main>
    );
  }

  const { distribution, byGroup, trend, calculatedAt } = query.data.data;
  const groupCount = query.data.meta?.groupCount ?? byGroup.length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-display">{t.title}</h1>
          <p className="text-body text-text-secondary">
            {t.subtitle.replace('{groupCount}', String(groupCount))}
          </p>
        </div>
        <TrendBadge trend={trend} label={t.trend[trend]} />
      </header>

      {/* Summary cards */}
      <section aria-labelledby="summary-heading" className="mb-10">
        <h2 id="summary-heading" className="text-heading mb-4">
          {t.summary.title}
        </h2>
        <p className="mb-4 text-body text-text-secondary">
          {t.summary.total.replace('{total}', String(distribution.total))}
        </p>
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          aria-label="Distribuição de status pastoral"
        >
          <li>
            <StatusSummaryCard
              label={t.status.verde}
              count={distribution.verde}
              total={distribution.total}
              variant="verde"
            />
          </li>
          <li>
            <StatusSummaryCard
              label={t.status.amarelo}
              count={distribution.amarelo}
              total={distribution.total}
              variant="amarelo"
            />
          </li>
          <li>
            <StatusSummaryCard
              label={t.status.vermelho}
              count={distribution.vermelho}
              total={distribution.total}
              variant="vermelho"
            />
          </li>
        </ul>
      </section>

      {/* Distribution by group */}
      <section aria-labelledby="by-group-heading">
        <h2 id="by-group-heading" className="text-heading mb-4">
          {t.byGroup.title}
        </h2>
        {byGroup.length === 0 ? (
          <p className="text-body text-text-secondary">{t.byGroup.noData}</p>
        ) : (
          <ul className="space-y-3">
            {byGroup.map((group) => (
              <GroupDistributionRow key={group.groupId} group={group} />
            ))}
          </ul>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-10 text-caption text-text-tertiary">
        <p>{t.footer.lastUpdated.replace('{timestamp}', formatDateTime(calculatedAt))}</p>
        <p>{t.footer.autoRefresh}</p>
      </footer>
    </main>
  );
}
