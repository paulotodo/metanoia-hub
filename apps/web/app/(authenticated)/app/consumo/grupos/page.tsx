'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ParticipantGroupSummary } from '@metanoia/types';
import messages from '../../../../../messages/pt-BR.json';
import { useParticipantGroups } from '@/lib/api/hooks/use-participant-groups';
import { useCurrentFirstName } from '@/lib/session/use-current-first-name';
import { formatScheduleShort } from '@/lib/format/day-of-week-label';
import { ParticipantGroupCard } from '@/components/groups/participant-group-card';

const t = messages.mygroups;
const tGroup = messages.mygroup;

function scheduleTextFor(group: ParticipantGroupSummary): string {
  if (!group.nextMeeting) return '';
  return formatScheduleShort(group.nextMeeting.dayOfWeek, group.nextMeeting.time);
}

function NotFoundToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams?.get('notFound') === '1') {
      setVisible(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('notFound');
      router.replace(url.pathname + (url.search || ''));
      const timer = window.setTimeout(() => setVisible(false), 4000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [searchParams, router]);

  if (!visible) return null;
  return (
    <div
      role="status"
      data-testid="mygroup-notfound-toast"
      className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--color-text-primary)] shadow-sm"
    >
      {tGroup.error.notFound}
    </div>
  );
}

export default function ParticipantGroupsPage() {
  const firstName = useCurrentFirstName();
  const { data, isPending, isError, refetch } = useParticipantGroups();

  if (isPending) {
    return (
      <main
        id="mygroups-header"
        className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8"
        aria-busy="true"
      >
        <h1 className="text-[24px] font-bold text-[var(--color-text-primary)]">
          {t.title}
        </h1>
        <div
          data-testid="mygroups-skeleton"
          className="flex flex-col gap-3"
          aria-hidden="true"
        >
          <div className="h-[96px] animate-pulse rounded-lg bg-[var(--muted)]" />
          <div className="h-[96px] animate-pulse rounded-lg bg-[var(--muted)]" />
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-8">
        <h1 className="text-[24px] font-bold text-[var(--color-text-primary)]">
          {t.title}
        </h1>
        <p
          data-testid="mygroups-error"
          className="text-sm text-[var(--color-text-muted)]"
        >
          {t.error.network}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="self-start rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--color-brand-teal)] hover:bg-[var(--muted)]"
        >
          {t.error.retry}
        </button>
      </main>
    );
  }

  const groups = data.data;
  const showWelcome = data.meta.firstVisit;

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8">
      <Suspense fallback={null}>
        <NotFoundToast />
      </Suspense>
      <section id="mygroups-header" className="flex flex-col gap-2">
        <h1 className="text-[24px] font-bold text-[var(--color-text-primary)]">
          {t.title}
        </h1>
        {showWelcome ? (
          <p
            data-testid="mygroups-welcome"
            className="text-base text-[var(--color-text-muted)]"
          >
            {t.welcome.replace('{firstName}', firstName ?? 'Boas-vindas')}
          </p>
        ) : null}
      </section>

      {groups.length === 0 ? (
        <section id="mygroups-empty">
          <p
            data-testid="mygroups-empty"
            className="text-center text-sm text-[var(--color-text-muted)]"
          >
            {t.empty}
          </p>
        </section>
      ) : (
        <ul
          id="mygroups-list"
          role="list"
          className="flex flex-col gap-3"
          data-testid="mygroups-list"
        >
          {groups.map((group) => (
            <ParticipantGroupCard
              key={group.id}
              group={group}
              scheduleText={scheduleTextFor(group)}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
