import { Suspense } from 'react';
import { DashboardClient } from './dashboard-client';
import { DashboardSkeleton } from './_components/dashboard-skeleton';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-10">
          <DashboardSkeleton />
        </main>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
