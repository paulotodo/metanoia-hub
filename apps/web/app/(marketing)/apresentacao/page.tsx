import type { Metadata } from 'next';
import { Button } from '@metanoia/ui';
import { DeckLight } from '../../../src/components/marketing/deck-light';
import { CopyLinkButton } from '../../../src/components/marketing/copy-link-button';
import messages from '../../../messages/pt-BR.json';

const t = messages.apresentacao;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
  openGraph: {
    title: t.title,
    description: t.subtitle,
    url: '/apresentacao',
  },
  twitter: { title: t.title, description: t.subtitle },
};

export default function ApresentacaoPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 md:py-20">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-muted)]">
          {t.subtitle}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" data-testid="deck-download-pdf">
            <a href="/apresentacao-metanoia.pdf" download>
              {t.downloadPdf}
            </a>
          </Button>
          <CopyLinkButton label={t.copyLink} copiedLabel={t.linkCopied} />
        </div>
      </header>

      <DeckLight />
    </section>
  );
}
