import type { ActivityEntry } from '@metanoia/types';
import messages from '../../../../../../../../messages/pt-BR.json';

const t = messages.leader.activity;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

const MAX_ITEMS = 5;

interface RecentActivityListProps {
  firstName: string;
  entries: ActivityEntry[];
}

export function RecentActivityList({
  firstName,
  entries,
}: RecentActivityListProps) {
  const visible = entries.slice(0, MAX_ITEMS);
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-heading mb-3">
        {t.label.replace('{firstName}', firstName)}
      </h2>
      {visible.length === 0 ? (
        <p className="text-body text-text-secondary">
          {t.empty.replace('{firstName}', firstName)}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((entry) => (
            <li
              key={entry.entryId}
              className="text-body-sm text-text-primary"
            >
              <span className="text-text-tertiary mr-2">
                📅 {formatDate(entry.occurredAt)}
              </span>
              {entry.description}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
