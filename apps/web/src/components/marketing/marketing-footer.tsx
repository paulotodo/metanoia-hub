import Link from 'next/link';
import messages from '../../../messages/pt-BR.json';

const t = messages.marketingFooter;
const nav = messages.marketingNav;

const SECTION_PRODUTO: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/funcionalidades', label: nav.funcionalidades },
  { href: '/precos', label: nav.precos },
  { href: '/apresentacao', label: nav.apresentacao },
];

const SECTION_IGREJA: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/manifesto', label: nav.manifesto },
  { href: '/estudo-de-caso', label: nav.estudoCaso },
  { href: '/blog', label: nav.blog },
];

const SECTION_CONTATO: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/sobre', label: nav.sobre },
  { href: '/contato', label: nav.contato },
  { href: '/comecar', label: nav.ctaPrimary },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-border-default)] bg-surface-base">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="text-base font-semibold text-text-primary">{nav.brand}</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t.tagline}</p>
        </div>
        <FooterSection title={t.sectionProduto} links={SECTION_PRODUTO} />
        <FooterSection title={t.sectionIgreja} links={SECTION_IGREJA} />
        <FooterSection title={t.sectionContato} links={SECTION_CONTATO} />
      </div>
      <div className="border-t border-[var(--color-border-default)] px-4 py-4">
        <p
          data-testid="marketing-footer-copyright"
          className="mx-auto max-w-6xl text-center text-xs text-[var(--color-text-muted)]"
        >
          {t.copyright.replace('{year}', String(year))}
        </p>
      </div>
    </footer>
  );
}

function FooterSection({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((link) => (
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
    </div>
  );
}
