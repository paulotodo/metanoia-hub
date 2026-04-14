'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@metanoia/ui';
import { CreateGroupForm } from './_components/create-group-form';
import messages from '../../../../../../messages/pt-BR.json';

function CriarPrimeiroGrupoContent() {
  const searchParams = useSearchParams();
  const isFirst = searchParams.get('first') === 'true';
  const t = messages.group;

  return (
    <section className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-text-primary lg:text-3xl">
          {isFirst ? t.create.title : t.create.titleNormal}
        </h1>
        <p className="text-sm text-text-secondary">{t.create.description}</p>
      </header>

      <Card className="p-6">
        <CreateGroupForm isFirst={isFirst} />
      </Card>
    </section>
  );
}

export default function CriarPrimeiroGrupoPage() {
  return (
    <Suspense fallback={null}>
      <CriarPrimeiroGrupoContent />
    </Suspense>
  );
}
