import { Suspense } from 'react';
import { VistaClient } from './vista-client';
import { VistaSkeleton } from './_components/vista-skeleton';

export default function VistaPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-10">
          <VistaSkeleton />
        </main>
      }
    >
      <VistaClient />
    </Suspense>
  );
}
