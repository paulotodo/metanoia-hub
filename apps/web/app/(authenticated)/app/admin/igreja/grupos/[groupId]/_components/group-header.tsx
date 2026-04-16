import type { GroupHeader as GroupHeaderData } from '@metanoia/types';
import messages from '../../../../../../../../messages/pt-BR.json';
import { StatusIndicator } from '../../../vista/_components/status-indicator';

const t = messages.drill.header;

interface GroupHeaderProps {
  group: GroupHeaderData;
}

export function GroupHeader({ group }: GroupHeaderProps) {
  return (
    <div
      data-testid="group-header"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h1 className="text-display mb-3">{group.groupName}</h1>
      <p className="text-body text-text-secondary mb-2">
        {t.leader.replace('{leaderName}', group.leaderName)}
      </p>
      <div className="mb-3">
        <StatusIndicator status={group.status} phrase={group.statusPhrase} />
      </div>
      <p className="text-body-sm text-text-tertiary">
        {t.details
          .replace('{schedule}', group.schedule)
          .replace('{location}', group.location)
          .replace('{memberCount}', String(group.memberCount))}
      </p>
    </div>
  );
}
