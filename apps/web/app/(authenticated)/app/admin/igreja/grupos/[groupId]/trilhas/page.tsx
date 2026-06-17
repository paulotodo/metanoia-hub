import { Suspense, use } from 'react';
import { GroupTrailsClient } from './group-trails-client';

interface PageProps {
  params: Promise<{ groupId: string }>;
}

export default function GroupTrailsPage({ params }: PageProps) {
  const { groupId } = use(params);
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-6 py-10">
          <div aria-busy="true" className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-16 motion-safe:animate-pulse rounded-lg border border-border bg-surface"
              />
            ))}
          </div>
        </main>
      }
    >
      <GroupTrailsClient groupId={groupId} />
    </Suspense>
  );
}
