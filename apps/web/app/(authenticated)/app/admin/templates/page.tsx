'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import messages from '../../../../../messages/pt-BR.json';
import { TemplatesList } from './templates-list';

const t = messages.templates;

function TemplatesListFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 h-40 animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {/* data-autofocus: FocusManager move o foco aqui após navegação */}
          <h1 className="text-display mb-1" data-autofocus>
            {t.page.title}
          </h1>
          <p className="text-body text-text-secondary">{t.page.subtitle}</p>
        </div>
        <Link
          href="/app/admin/templates/novo"
          className="inline-flex h-11 shrink-0 items-center rounded-lg bg-[var(--color-interactive-primary)] px-6 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-interactive-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
          aria-label={t.crud.createTitle}
        >
          {t.crud.saveAsTemplate}
        </Link>
      </header>

      <Suspense fallback={<TemplatesListFallback />}>
        <TemplatesList />
      </Suspense>
    </main>
  );
}
