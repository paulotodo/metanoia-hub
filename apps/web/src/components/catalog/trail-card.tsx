'use client';

import type { KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import messages from '../../../messages/pt-BR.json';

const t = messages.catalog;

export interface CatalogTrailCardProps {
  trailId: string;
  name: string;
  description?: string;
  category?: string;
  status?: 'not_started' | 'in_progress' | 'completed';
  moduleCount?: number;
  lessonCount?: number;
  href: string;
}

/**
 * Story 12.2 — US5, FR-017
 *
 * Card focável e ativável por teclado no catálogo de trilhas.
 * Implementado como <a> para garantir:
 *  - role="link" nativo (FR-017)
 *  - focável via Tab sem tabIndex extra
 *  - Enter ativa (comportamento nativo de <a>)
 *  - Compatível com screen readers (VoiceOver/NVDA/JAWS)
 */
export function TrailCard({
  trailId,
  name,
  description,
  category,
  status = 'not_started',
  moduleCount,
  lessonCount,
  href,
}: CatalogTrailCardProps) {
  const router = useRouter();

  // Suporte a Space para ativar (complementa o comportamento nativo de Enter em <a>)
  function handleKeyDown(e: KeyboardEvent<HTMLAnchorElement>) {
    if (e.key === ' ') {
      e.preventDefault();
      router.push(href);
    }
  }

  const statusLabel = t.trailCard.status[status] ?? status;

  const meta: string[] = [];
  if (moduleCount !== undefined) meta.push(`${moduleCount} módulo${moduleCount !== 1 ? 's' : ''}`);
  if (lessonCount !== undefined) meta.push(`${lessonCount} aula${lessonCount !== 1 ? 's' : ''}`);

  return (
    <a
      href={href}
      data-trail-id={trailId}
      aria-label={t.trailCard.activate.replace('{name}', name)}
      onKeyDown={handleKeyDown}
      className={[
        'block rounded-lg border border-border bg-background p-4',
        'hover:bg-accent/50',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 focus-visible:ring-offset-2',
        'transition-colors',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground leading-snug">{name}</h3>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground"
          aria-label={`Status: ${statusLabel}`}
        >
          {statusLabel}
        </span>
      </div>

      {description && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{description}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {category && <span className="rounded-full bg-muted px-2 py-0.5">{category}</span>}
        {meta.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </a>
  );
}
