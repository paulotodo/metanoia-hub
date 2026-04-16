import Link from 'next/link';
import { Button } from '@metanoia/ui';
import messages from '../../../messages/pt-BR.json';

const t = messages.marketingNav;

const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/manifesto', label: t.manifesto },
  { href: '/funcionalidades', label: t.funcionalidades },
  { href: '/estudo-de-caso', label: t.estudoCaso },
  { href: '/precos', label: t.precos },
  { href: '/apresentacao', label: t.apresentacao },
  { href: '/blog', label: t.blog },
  { href: '/sobre', label: t.sobre },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-default)] bg-surface-base/90 backdrop-blur">
      <nav
        aria-label="Marketing"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4"
      >
        <Link
          href="/"
          data-testid="marketing-nav-brand"
          className="text-lg font-semibold tracking-tight text-text-primary"
        >
          {t.brand}
        </Link>
        <ul className="hidden items-center gap-6 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[var(--color-text-muted)] transition-colors hover:text-text-primary"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild size="sm" data-testid="marketing-nav-cta-primary">
          <Link href="/comecar">{t.ctaPrimary}</Link>
        </Button>
      </nav>
    </header>
  );
}
