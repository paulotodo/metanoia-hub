'use client';

import messages from '../../../../../../../messages/pt-BR.json';
import { useLeaderView } from '../../../../../../../src/lib/api/hooks/use-pastoral-admin';
import { BackLink } from '../../grupos/[groupId]/_components/back-link';
import { DrillErrorState } from '../../grupos/[groupId]/_components/drill-error-state';
import { LastConversationEntry } from './_components/last-conversation-entry';
import { LeaderProfileCard } from './_components/leader-profile-card';
import { LeaderSkeleton } from './_components/leader-skeleton';
import { OutreachIntentForm } from './_components/outreach-intent-form';
import { RecentActivityList } from './_components/recent-activity-list';

const t = messages.leader;

interface LiderClientProps {
  leaderId: string;
  groupId: string | null;
}

export function LiderClient({ leaderId, groupId }: LiderClientProps) {
  const query = useLeaderView(leaderId);

  const backHref = groupId
    ? `/app/admin/igreja/grupos/${groupId}`
    : '/app/admin/igreja/vista';

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6">
        <BackLink href={backHref} label={t.back} />
      </div>

      {query.isPending ? (
        <LeaderSkeleton />
      ) : query.isError ? (
        <DrillErrorState onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-6">
          <LeaderProfileCard leader={query.data.data.leader} />
          <LastConversationEntry
            firstName={query.data.data.leader.firstName}
            conversation={query.data.data.lastConversation}
          />
          <RecentActivityList
            firstName={query.data.data.leader.firstName}
            entries={query.data.data.recentActivity}
          />
          <OutreachIntentForm
            leaderId={leaderId}
            currentIntent={query.data.data.currentWeekIntent}
          />
        </div>
      )}
    </main>
  );
}
