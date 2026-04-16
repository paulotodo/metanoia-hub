import { Suspense, use } from 'react';
import { LiderClient } from './lider-client';
import { LeaderSkeleton } from './_components/leader-skeleton';

interface PageProps {
  params: Promise<{ leaderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function LiderPage({ params, searchParams }: PageProps) {
  const { leaderId } = use(params);
  const sp = use(searchParams);
  const groupRaw = sp.fromGroup;
  const groupId = typeof groupRaw === 'string' ? groupRaw : null;

  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-6 py-10">
          <LeaderSkeleton />
        </main>
      }
    >
      <LiderClient leaderId={leaderId} groupId={groupId} />
    </Suspense>
  );
}
