import type { Metadata } from 'next';
import { MarketingFooter, MarketingNav } from '../../src/components/marketing';

export const metadata: Metadata = {
  title: {
    default: 'metanoia — Tecnologia que devolve o pastor ao rebanho',
    template: '%s — metanoia',
  },
  description:
    'Plataforma pastoral para igrejas que querem cuidar das suas pessoas sem se perder em planilhas.',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'metanoia',
    title: 'metanoia — Tecnologia que devolve o pastor ao rebanho',
    description:
      'Plataforma pastoral para igrejas que querem cuidar das suas pessoas sem se perder em planilhas.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'metanoia',
    description:
      'Plataforma pastoral para igrejas que querem cuidar das suas pessoas sem se perder em planilhas.',
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-base text-text-primary">
      <MarketingNav />
      <main id="conteudo" className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
