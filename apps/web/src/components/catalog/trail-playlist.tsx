'use client';

import type { KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import messages from '../../../messages/pt-BR.json';

const t = messages.catalog;

export interface CatalogTrailPlaylistItem {
  trailId: string;
  name: string;
  description?: string;
  moduleCount?: number;
  lessonCount?: number;
  href: string;
}

interface TrailPlaylistProps {
  items: CatalogTrailPlaylistItem[];
  'aria-label'?: string;
}

/**
 * Story 12.2 — US5, FR-017
 *
 * Lista de cards de trilha no catálogo.
 * Cada item é um <a> focável (role=link nativo, Enter ativa).
 * Estrutura em <ul>/<li> para semântica de lista (screen readers anunciam
 * "item N de M" ao navegar com Tab).
 */
export function TrailPlaylist({
  items,
  'aria-label': ariaLabel = t.title,
}: TrailPlaylistProps) {
  const router = useRouter();

  function makeKeyDownHandler(href: string) {
    return (e: KeyboardEvent<HTMLAnchorElement>) => {
      if (e.key === ' ') {
        e.preventDefault();
        router.push(href);
      }
    };
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4" role="status">
        {messages.catalog.noResults}
      </p>
    );
  }

  return (
    <ul
      role="list"
      aria-label={ariaLabel}
      className="space-y-2"
    >
      {items.map(({ trailId, name, description, moduleCount, lessonCount, href }) => {
        const meta: string[] = [];
        if (moduleCount !== undefined)
          meta.push(`${moduleCount} módulo${moduleCount !== 1 ? 's' : ''}`);
        if (lessonCount !== undefined)
          meta.push(`${lessonCount} aula${lessonCount !== 1 ? 's' : ''}`);

        return (
          <li key={trailId}>
            <a
              href={href}
              data-trail-id={trailId}
              aria-label={t.trailCard.activate.replace('{name}', name)}
              onKeyDown={makeKeyDownHandler(href)}
              className={[
                'block rounded-lg border border-border bg-background p-4',
                'hover:bg-accent/50',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'transition-colors',
              ].join(' ')}
            >
              <p className="text-sm font-semibold text-foreground">{name}</p>
              {description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>
              )}
              {meta.length > 0 && (
                <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                  {meta.map((m) => <span key={m}>{m}</span>)}
                </div>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
