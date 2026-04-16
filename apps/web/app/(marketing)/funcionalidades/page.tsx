import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@metanoia/ui';
import { FeatureGrid } from '../../../src/components/marketing/feature-grid';
import messages from '../../../messages/pt-BR.json';

const t = messages.funcionalidades;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

export default function FuncionalidadesPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-muted)]">
          {t.subtitle}
        </p>
      </header>

      <FeatureGrid />

      <footer className="mx-auto mt-20 max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          {t.ctaHeading}
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" data-testid="funcionalidades-cta-primary">
            <Link href="/estudo-de-caso">{t.ctaPrimary}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            data-testid="funcionalidades-cta-secondary"
          >
            <Link href="/contato">{t.ctaSecondary}</Link>
          </Button>
        </div>
      </footer>
    </section>
  );
}
