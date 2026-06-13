'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import messages from '../../../../../messages/pt-BR.json';
import { useGroupsList } from '../../../../../src/lib/api/hooks/use-groups';
import { DemoOverlay } from '../../../../../src/components/onboarding/demo-overlay';
import { DemoDataNudge } from '../../../../../src/components/onboarding/demo-data-nudge';

const t = messages.group.list;

function GroupsListContent() {
  const { data, isPending, isError, refetch } = useGroupsList();

  if (isPending) {
    return (
      <p className="text-body text-text-secondary" role="status">
        {t.loading}
      </p>
    );
  }

  if (isError) {
    return (
      <div className="space-y-2">
        <p className="text-body text-care-alert">{t.error}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-sm text-interactive-primary underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const groups = data?.data ?? [];

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-body text-text-secondary">{t.empty}</p>
        <Link
          href="/app/admin/grupos/novo?first=true"
          className="inline-flex h-11 items-center rounded-lg bg-interactive-primary px-6 text-sm font-semibold text-text-inverse hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
        >
          {t.emptyAction}
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => {
        const card = (
          <article
            data-testid={`group-item-${group.id}`}
            className="rounded-lg border border-border bg-surface p-5 shadow-sm"
          >
            <h3 className="text-heading mb-1">{group.name}</h3>
            <p className="text-body-sm text-text-secondary">
              {group.dayOfWeek} — {group.time}
            </p>
          </article>
        );

        return (
          <li key={group.id}>
            {group.isDemoData ? (
              <DemoOverlay>{card}</DemoOverlay>
            ) : (
              card
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function GruposPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display mb-1">{t.title}</h1>
          <p className="text-body text-text-secondary">{t.subtitle}</p>
        </div>
        <Link
          href="/app/admin/grupos/novo"
          className="inline-flex h-11 items-center rounded-lg bg-interactive-primary px-6 text-sm font-semibold text-text-inverse hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
        >
          {t.newGroup}
        </Link>
      </header>

      {/* DemoDataNudge: Client Component — shows dialog when hasDemoData && hasRealData */}
      <DemoDataNudge />

      <Suspense
        fallback={
          <p className="text-body text-text-secondary" role="status">
            {t.loading}
          </p>
        }
      >
        <GroupsListContent />
      </Suspense>
    </main>
  );
}
