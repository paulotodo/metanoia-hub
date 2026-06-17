import Link from 'next/link';
import { Button } from '@metanoia/ui';
import messages from '../../../messages/pt-BR.json';

const t = messages.landing.hero;

export function HeroSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 text-center md:py-28">
      <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-6xl">
        {t.headline}
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-secondary md:text-xl">
        {t.subheadline}
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
        <Button asChild size="lg" data-testid="hero-cta-primary">
          <Link href="/comecar">{t.ctaPrimary}</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          data-testid="hero-cta-secondary"
        >
          <Link href="/manifesto">{t.ctaSecondary}</Link>
        </Button>
      </div>
    </section>
  );
}
