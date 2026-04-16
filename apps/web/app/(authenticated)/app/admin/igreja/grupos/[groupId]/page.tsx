import { Suspense, use } from 'react';
import { GrupoClient } from './grupo-client';
import { DrillSkeleton } from './_components/drill-skeleton';

interface PageProps {
  params: Promise<{ groupId: string }>;
}

export default function GrupoDrillDownPage({ params }: PageProps) {
  const { groupId } = use(params);
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-6 py-10">
          <DrillSkeleton />
        </main>
      }
    >
      <GrupoClient groupId={groupId} />
    </Suspense>
  );
}
