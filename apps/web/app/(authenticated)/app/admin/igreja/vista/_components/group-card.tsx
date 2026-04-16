import Link from 'next/link';
import type { GroupCard as GroupCardData } from '@metanoia/types';
import messages from '../../../../../../../messages/pt-BR.json';
import { StatusIndicator, STATUS_BORDER_CLASSES } from './status-indicator';

const t = messages.vista;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

interface GroupCardProps {
  group: GroupCardData;
  href: string;
}

export function GroupCard({ group, href }: GroupCardProps) {
  const lastMeeting = formatDate(group.lastMeetingAt);
  return (
    <Link
      href={href}
      data-testid={`group-card-${group.groupId}`}
      className={`block rounded-lg border border-border bg-surface p-5 border-l-4 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${STATUS_BORDER_CLASSES[group.status]}`}
    >
      <h3 className="text-heading mb-2">{group.groupName}</h3>
      <div className="mb-3">
        <StatusIndicator status={group.status} phrase={group.statusPhrase} />
      </div>
      <dl className="space-y-1 text-body-sm text-text-secondary">
        <div>
          <span>{t.card.leader.replace('{leaderName}', group.leaderName)}</span>
        </div>
        <div>
          <span>{t.card.lastMeeting.replace('{date}', lastMeeting)}</span>
        </div>
        <div>
          <span>
            {t.card.members.replace('{count}', String(group.memberCount))}
          </span>
        </div>
      </dl>
    </Link>
  );
}
