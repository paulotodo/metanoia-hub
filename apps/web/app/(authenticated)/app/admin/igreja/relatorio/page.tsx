import { Suspense } from 'react';
import type { Metadata } from 'next';
import messages from '../../../../../../messages/pt-BR.json';
import { TenantSummaryDashboard } from './tenant-summary-dashboard';
import { TenantSummarySkeleton } from './_components/tenant-summary-skeleton';

export const metadata: Metadata = {
  title: messages.tenantReport.title,
};

export default function TenantSummaryPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-10">
          <TenantSummarySkeleton />
        </main>
      }
    >
      <TenantSummaryDashboard />
    </Suspense>
  );
}
