import type { Metadata } from 'next';
import messages from '../../messages/pt-BR.json';

const t = messages.landing.hero;

export const metadata: Metadata = {
  title: 'Tecnologia que devolve o pastor ao rebanho',
  description:
    'Uma plataforma pensada para igrejas que querem cuidar das suas pessoas sem se perder em planilhas.',
};

export default function LandingPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
        {t.headline}
      </h1>
      <p className="mt-6 text-lg text-[var(--color-text-muted)]">
        {t.subheadline}
      </p>
      <p className="mt-12 text-sm text-[var(--color-text-muted)]">
        Landing completa chega na Session 2.
      </p>
    </section>
  );
}
