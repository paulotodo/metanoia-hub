'use client';

import { ExternalLink } from 'lucide-react';

interface ExternalLinkViewProps {
  /** The external URL to display */
  url: string;
  /** Display title for the link */
  title?: string;
  /** Optional description shown on the preview card */
  description?: string;
  className?: string;
}

/**
 * ExternalLinkView — cartão de preview para aulas com conteúdo externo.
 * Abre sempre em nova aba com rel="noopener noreferrer" por segurança.
 */
export function ExternalLinkView({ url, title, description, className }: ExternalLinkViewProps) {
  // Sanitize: only allow http/https links to prevent javascript: injection
  let safeUrl = '#';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      safeUrl = url;
    }
  } catch {
    // Invalid URL — keep safeUrl as '#'
  }

  return (
    <div
      className={`rounded-lg border bg-card p-5 ${className ?? ''}`}
      data-testid="external-link-view"
    >
      <div className="flex flex-col gap-3">
        {title && (
          <p className="font-semibold text-card-foreground line-clamp-2">{title}</p>
        )}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{description}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">{url}</p>
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="external-link-button"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Abrir em nova aba
        </a>
      </div>
    </div>
  );
}
