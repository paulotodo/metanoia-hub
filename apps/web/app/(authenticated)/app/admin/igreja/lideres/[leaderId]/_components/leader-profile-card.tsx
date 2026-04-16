import type { LeaderProfile } from '@metanoia/types';
import messages from '../../../../../../../../messages/pt-BR.json';

const t = messages.leader.header;

interface LeaderProfileCardProps {
  leader: LeaderProfile;
}

export function LeaderProfileCard({ leader }: LeaderProfileCardProps) {
  return (
    <div
      data-testid="leader-profile"
      className="rounded-lg border border-border bg-surface p-6"
    >
      <h1 className="text-display mb-2">{leader.fullName}</h1>
      <p className="text-body text-text-secondary">
        {t.context
          .replace('{groupName}', leader.groupName)
          .replace('{tenure}', leader.tenure)}
      </p>
    </div>
  );
}
