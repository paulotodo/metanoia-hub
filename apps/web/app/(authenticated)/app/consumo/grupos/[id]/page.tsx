'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import messages from '../../../../../../messages/pt-BR.json';
import { useParticipantGroup } from '@/lib/api/hooks/use-participant-groups';
import { LeaderAvatar } from '@/components/avatar/leader-avatar';
import { formatRelativeMeeting } from '@/lib/format/relative-meeting';
import { dayOfWeekLabel } from '@/lib/format/day-of-week-label';
import { ApiError } from '@/lib/api/client';

const t = messages.mygroup;

function formatHour(time: string): string {
  const [h, m] = time.split(':');
  const hour = Number(h).toString();
  return m && m !== '00' ? `${hour}h${m}` : `${hour}h`;
}

function formatRelativeLabel(startsAt: string): string {
  const rel = formatRelativeMeeting(startsAt);
  if (rel.type === 'today') return 'hoje';
  if (rel.type === 'tomorrow') return 'amanhã';
  return `em ${rel.days} dias`;
}

export default function ParticipantGroupDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useParticipantGroup(id);

  const isNotFound =
    isError && error instanceof ApiError && error.statusCode === 404;

  useEffect(() => {
    if (isNotFound) {
      router.replace('/app/consumo/grupos?notFound=1');
    }
  }, [isNotFound, router]);

  if (isNotFound) {
    return null;
  }

  if (isPending) {
    return (
      <main
        className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8"
        aria-busy="true"
      >
        <BackLink />
        <div
          data-testid="mygroup-skeleton"
          aria-hidden="true"
          className="flex flex-col gap-4"
        >
          <div className="mx-auto h-16 w-16 motion-safe:animate-pulse rounded-full bg-[var(--muted)]" />
          <div className="h-6 w-2/3 motion-safe:animate-pulse rounded bg-[var(--muted)]" />
          <div className="h-24 motion-safe:animate-pulse rounded bg-[var(--muted)]" />
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-8">
        <BackLink />
        <p data-testid="mygroup-error" className="text-sm text-[var(--color-text-muted)]">
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

  const group = data.data;
  const formatLabelMap: Record<'in_person' | 'online' | 'hybrid', string> = {
    in_person: t.format.inPerson,
    online: t.format.online,
    hybrid: t.format.hybrid,
  };

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 py-8">
      <BackLink />

      <section
        id="mygroup-leader"
        className="flex flex-col items-center gap-3 text-center"
      >
        <LeaderAvatar
          size={64}
          firstName={group.leader.firstName}
          avatarUrl={group.leader.avatarUrl}
        />
        <p className="text-base text-[var(--color-text-muted)]">
          {t.leader.label.replace(
            '{leaderFirstName}',
            group.leader.firstName,
          )}
        </p>
      </section>

      <section id="mygroup-info" className="flex flex-col gap-4">
        <h1 className="text-[28px] font-bold leading-tight text-[var(--color-text-primary)]">
          {group.name}
        </h1>
        {group.description ? (
          <blockquote
            data-testid="mygroup-description"
            className="border-l-4 border-[var(--color-brand-teal)] pl-4 italic text-[var(--color-text-muted)]"
          >
            {group.description}
          </blockquote>
        ) : null}
      </section>

      <section
        id="mygroup-meeting"
        role="region"
        aria-labelledby="mygroup-meeting-h"
        className="flex flex-col gap-2"
      >
        <h3
          id="mygroup-meeting-h"
          className="text-[18px] font-semibold text-[var(--color-text-primary)]"
        >
          {t.meeting.label}
        </h3>
        {group.nextMeeting ? (
          <>
            <p data-testid="mygroup-meeting-date" className="text-base">
              {t.meeting.date
                .replace(
                  '{dayOfWeek}',
                  dayOfWeekLabel(group.nextMeeting.dayOfWeek, 'singular'),
                )
                .replace('{time}', formatHour(group.nextMeeting.time))}
            </p>
            <p
              data-testid="mygroup-meeting-relative"
              className="text-sm text-[var(--color-text-muted)]"
            >
              {formatRelativeLabel(group.nextMeeting.startsAt)}
            </p>
            {group.nextMeeting.location ? (
              <p
                data-testid="mygroup-meeting-location"
                className="text-sm text-[var(--color-text-muted)]"
              >
                {t.meeting.location.replace(
                  '{location}',
                  group.nextMeeting.location,
                )}
              </p>
            ) : null}
          </>
        ) : (
          <p
            data-testid="mygroup-meeting-empty"
            className="text-sm text-[var(--color-text-muted)]"
          >
            {t.meeting.empty}
          </p>
        )}
      </section>

      {group.format !== null ? (
        <section
          id="mygroup-format"
          role="region"
          aria-labelledby="mygroup-format-h"
          className="flex flex-col gap-2"
          data-testid="mygroup-format"
        >
          <h3
            id="mygroup-format-h"
            className="text-[18px] font-semibold text-[var(--color-text-primary)]"
          >
            {t.format.label}
          </h3>
          <p className="text-base text-[var(--color-text-muted)]">
            {group.duration
              ? t.format.detail
                  .replace('{format}', formatLabelMap[group.format])
                  .replace('{duration}', group.duration)
              : t.format.detailNoDuration.replace(
                  '{format}',
                  formatLabelMap[group.format],
                )}
          </p>
        </section>
      ) : null}

      {group.peers !== undefined && group.peers.length > 0 ? (
        <section
          id="mygroup-peers"
          role="region"
          aria-labelledby="mygroup-peers-h"
          className="flex flex-col gap-2"
          data-testid="mygroup-peers"
        >
          <h3
            id="mygroup-peers-h"
            className="text-[18px] font-semibold text-[var(--color-text-primary)]"
          >
            {t.peers.label}
          </h3>
          <ul role="list" className="flex flex-wrap gap-2">
            {group.peers.map((peer, idx) => (
              <li
                key={`${peer.firstName}-${idx}`}
                className="rounded-full bg-[var(--muted)] px-3 py-1 text-sm text-[var(--color-text-primary)]"
              >
                {peer.firstName}
              </li>
            ))}
          </ul>
        </section>
      ) : group.peers !== undefined ? (
        <section
          id="mygroup-peers"
          role="region"
          aria-labelledby="mygroup-peers-h"
          className="flex flex-col gap-2"
          data-testid="mygroup-peers-empty"
        >
          <h3
            id="mygroup-peers-h"
            className="text-[18px] font-semibold text-[var(--color-text-primary)]"
          >
            {t.peers.label}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.peers.empty}
          </p>
        </section>
      ) : null}

      <section id="mygroup-closing">
        <p className="text-center text-[var(--color-text-muted)]">
          {t.closing}
        </p>
      </section>
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/app/consumo/grupos"
      data-testid="mygroup-back"
      className="inline-flex items-center gap-1 text-sm text-[var(--color-brand-teal)] hover:underline"
    >
      <span aria-hidden="true">←</span> {t.back}
    </Link>
  );
}
