import { Suspense, use } from 'react';
import type { Metadata } from 'next';
import { ImportClient } from './import-client';

export const metadata: Metadata = {
  title: 'Importar Participantes — Metanoia Hub',
  description: 'Importe participantes do grupo via planilha CSV ou XLSX.',
};

interface PageProps {
  params: Promise<{ groupId: string }>;
}

export default function ImportarParticipantesPage({ params }: PageProps) {
  const { groupId } = use(params);
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-6 py-10">
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
      <ImportClient groupId={groupId} />
    </Suspense>
  );
}
