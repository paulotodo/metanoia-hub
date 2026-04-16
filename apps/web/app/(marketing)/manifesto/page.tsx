import type { Metadata } from 'next';
import messages from '../../../messages/pt-BR.json';

const t = messages.manifesto;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

export default function ManifestoPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">
        {t.title}
      </h1>
      <p className="mt-4 text-lg text-[var(--color-text-muted)]">{t.subtitle}</p>
      <p className="mt-12 text-sm text-[var(--color-text-muted)]">
        Conteúdo completo chega na Session 2.
      </p>
    </section>
  );
}
