'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import messages from '../../../../../../../messages/pt-BR.json';
import { useGroupTimeline } from '../../../../../../../src/lib/api/hooks/use-pastoral-admin';
import { BackLink } from './_components/back-link';
import { DrillErrorState } from './_components/drill-error-state';
import { DrillSkeleton } from './_components/drill-skeleton';
import { GroupHeader } from './_components/group-header';
import { PastoralTimeline } from './_components/pastoral-timeline';

const t = messages.drill;

interface GrupoClientProps {
  groupId: string;
}

export function GrupoClient({ groupId }: GrupoClientProps) {
  const searchParams = useSearchParams();
  const vistaQs = searchParams.toString();
  const vistaHref = vistaQs
    ? `/app/admin/igreja/vista?${vistaQs}`
    : '/app/admin/igreja/vista';

  const query = useGroupTimeline(groupId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-6">
        <BackLink href={vistaHref} label={t.back} />
      </div>

      {query.isPending ? (
        <DrillSkeleton />
      ) : query.isError ? (
        <DrillErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <GroupHeader group={query.data.data.group} />

          <div className="mt-8">
            <h2 className="text-heading mb-4">{t.timeline.label}</h2>
            <PastoralTimeline entries={query.data.data.entries} />
          </div>

          <div className="mt-8 flex justify-end">
            <Link
              href={`/app/admin/igreja/lideres/${query.data.data.group.leaderId}?fromGroup=${groupId}`}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-body-sm text-primary-foreground hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t.action.viewLeader}
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
