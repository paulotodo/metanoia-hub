/**
 * skip-nav.tsx — Skip Navigation component (WCAG 2.1 SC 2.4.1 Bypass Blocks)
 *
 * Server Component — pure anchor, no useState/useEffect required.
 *
 * Usage: place as FIRST child of <body> in apps/web/app/layout.tsx.
 * Every layout that wraps its content in <main id="conteudo"> benefits
 * automatically.
 *
 * Ref: US1, FR-001, SC-001 — feature a11y-teclado-publico FASE 1
 * i18n: string literal per CHK013 decision (next-intl not available in root layout
 * RSC without provider; pastoral vocabulary in PT-BR per CLAUDE.md rules)
 */

export function SkipNav() {
  return (
    <a
      href="#conteudo"
      className={[
        // Hidden by default: off-screen via transform (no visibility:hidden to keep it
        // in focus order; position:absolute to not disturb page flow)
        'skip-nav',
        // Base layout
        'absolute left-4 top-4 z-[9999]',
        // Visible styling when focused — high contrast (>= 4.5:1 WCAG AA)
        // bg-white (#ffffff) on text-text-primary (#1a1a1a): contrast ratio ~16:1
        'rounded px-4 py-2',
        'bg-white text-text-primary font-medium text-sm',
        'border-2 border-brand-primary',
        // Transition for smooth reveal
        'transition-transform duration-150',
        // Hidden state: slide up off-screen
        '-translate-y-[calc(100%+1rem)]',
        // Visible on focus
        'focus-visible:translate-y-0',
        // Ensure it appears above all other content when focused
        'focus:translate-y-0',
      ].join(' ')}
    >
      {/* PT-BR pastoral vocabulary per CLAUDE.md — centralized string per CHK013 */}
      Ir para o conteúdo
    </a>
  );
}
