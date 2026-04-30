import Link from 'next/link';
import type { ParticipantGroupSummary } from '@metanoia/types';
import messages from '../../../messages/pt-BR.json';

const t = messages.mygroups;

interface ParticipantGroupCardProps {
  group: ParticipantGroupSummary;
  scheduleText: string;
}

export function ParticipantGroupCard({
  group,
  scheduleText,
}: ParticipantGroupCardProps) {
  const leaderLine = t.card.leader.replace('{leaderName}', group.leader.firstName);
  const scheduleLine = t.card.schedule.replace('{schedule}', scheduleText);

  return (
    <li className="list-none">
      <Link
        href={`/app/consumo/grupos/${group.id}`}
        aria-label={group.name}
        data-testid={`participant-group-card-${group.id}`}
        className="flex min-h-[96px] w-full flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--color-brand-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-teal)]"
      >
        <h2 className="text-[18px] font-semibold leading-tight text-[var(--color-text-primary)]">
          {group.name}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">{leaderLine}</p>
        {scheduleText ? (
          <p className="text-sm text-[var(--color-text-muted)]">{scheduleLine}</p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-[var(--color-brand-teal)]">
          {t.card.view}
        </p>
      </Link>
    </li>
  );
}
