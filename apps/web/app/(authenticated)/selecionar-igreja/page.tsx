import type { Metadata } from 'next';
import { ChurchSelectClient } from './_components/church-select-client';
import messages from '../../../messages/pt-BR.json';

const t = messages.churchSelect;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

export default function SelecionarIgrejaPage() {
  return (
    <main className="mx-auto flex w-full max-w-[360px] flex-col gap-6 px-4 pb-6 pt-12">
      <header className="flex flex-col gap-2 text-center">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
          {t.title}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{t.subtitle}</p>
      </header>
      <ChurchSelectClient />
    </main>
  );
}
