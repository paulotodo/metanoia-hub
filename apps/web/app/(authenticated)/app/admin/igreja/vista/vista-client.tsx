'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import messages from '../../../../../../messages/pt-BR.json';
import { useGroupsAggregated } from '../../../../../../src/lib/api/hooks/use-pastoral-admin';
import { GroupCard } from './_components/group-card';
import { VistaFilterBar } from './_components/vista-filter-bar';
import {
  VistaEmptyState,
  VistaFilteredEmpty,
} from './_components/vista-empty-state';
import { VistaErrorState } from './_components/vista-error-state';
import { VistaSkeleton } from './_components/vista-skeleton';
import {
  VistaStaleBanner,
  isStale,
} from './_components/vista-stale-banner';
import {
  filterGroups,
  parseFilter,
  type VistaFilter,
} from './vista-filters';

const t = messages.vista;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VistaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = parseFilter(searchParams.get('filtro'));

  const query = useGroupsAggregated();

  const handleFilterChange = useCallback(
    (next: VistaFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'all') params.delete('filtro');
      else params.set('filtro', next);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router, searchParams],
  );

  const visibleGroups = useMemo(() => {
    if (!query.data) return [];
    return filterGroups(query.data.data, filter);
  }, [query.data, filter]);

  const totalGroups = query.data?.data.length ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-display mb-2">{t.title}</h1>
        <p className="text-body text-text-secondary">
          {t.subtitle.replace('{groupCount}', String(totalGroups))}
        </p>
      </header>

      <div className="mb-6">
        <VistaFilterBar active={filter} onChange={handleFilterChange} />
      </div>

      {query.isPending ? (
        <VistaSkeleton />
      ) : query.isError ? (
        <VistaErrorState onRetry={() => void query.refetch()} />
      ) : totalGroups === 0 ? (
        <VistaEmptyState />
      ) : visibleGroups.length === 0 ? (
        <VistaFilteredEmpty message={t.filter.empty} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleGroups.map((group) => (
            <li key={group.groupId}>
              <GroupCard
                group={group}
                href={`/app/admin/igreja/grupos/${group.groupId}`}
              />
            </li>
          ))}
        </ul>
      )}

      {query.data ? (
        <>
          {isStale(query.data.meta.lastCalculatedAt) ? (
            <div className="mt-6">
              <VistaStaleBanner
                lastCalculatedAt={query.data.meta.lastCalculatedAt}
              />
            </div>
          ) : null}
          <p className="mt-8 text-caption text-text-tertiary">
            {t.footer.lastUpdated.replace(
              '{timestamp}',
              formatDateTime(query.data.meta.lastCalculatedAt),
            )}
          </p>
        </>
      ) : null}
    </main>
  );
}
