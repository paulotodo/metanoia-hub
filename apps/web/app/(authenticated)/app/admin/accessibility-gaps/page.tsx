import { Suspense } from 'react';
import messages from '../../../../../messages/pt-BR.json';
import { AccessibilityGapsList } from './_components/accessibility-gaps-list';

const t = messages.admin.accessibilityGaps;

export const metadata = {
  title: 'Acessibilidade — Conteúdo com Alt-Text Faltando',
};

export default function AccessibilityGapsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text-primary mb-2">{t.title}</h1>
      <p className="text-body text-text-secondary mb-8">{t.description}</p>
      <Suspense
        fallback={
          <p className="text-body text-text-secondary" role="status" aria-live="polite">
            {t.loading}
          </p>
        }
      >
        <AccessibilityGapsList />
      </Suspense>
    </main>
  );
}
