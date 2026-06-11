'use client';

import React, { useState, useCallback } from 'react';
import type { SearchResultItem } from '@metanoia/types';
import { useSearch } from '@/lib/api/hooks/use-search';
import { SearchHighlight } from './search-highlight';
import messages from '../../../messages/pt-BR.json';

const t = messages.search;

function useDebounce(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setDebounced(value), delayMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delayMs]);

  return debounced;
}

interface TrailsSearchProps {
  className?: string;
  onResultClick?: (item: SearchResultItem) => void;
}

/**
 * Client Component: full-text search field for lessons/trails.
 *
 * - 300ms debounce before issuing request
 * - Snippet highlighted via JSX (no dangerouslySetInnerHTML — dec-014)
 * - Badge "Rascunho" for draft trails (isDraft: true)
 * - Pastoral PT-BR empty state
 * - Keyboard navigable results
 */
export function TrailsSearch({ className, onResultClick }: TrailsSearchProps) {
  const [input, setInput] = useState('');
  const debouncedQ = useDebounce(input, 300);

  const { data, isLoading, error } = useSearch(debouncedQ);
  const results = data?.data ?? [];
  const hasQuery = debouncedQ.trim().length > 0;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value),
    [],
  );

  return (
    <div className={className} role="search">
      <label htmlFor="trilhas-search-input" className="sr-only">
        {t.placeholder}
      </label>
      <input
        id="trilhas-search-input"
        type="search"
        value={input}
        onChange={handleChange}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
        aria-busy={isLoading}
        aria-controls="trilhas-search-results"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        autoComplete="off"
      />

      {/* Results container always in DOM so aria-controls reference is valid */}
      <div
        id="trilhas-search-results"
        role="region"
        aria-label={t.resultsCount.replace('{count}', String(results.length))}
        className="mt-2"
        aria-hidden={!hasQuery}
      >
        {hasQuery && isLoading && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Buscando...
          </p>
        )}

        {hasQuery && error && (
          <p className="text-sm text-destructive" role="alert">
            Não foi possível realizar a busca. Tente novamente.
          </p>
        )}

        {hasQuery && !isLoading && !error && results.length === 0 && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t.emptyState}
          </p>
        )}

        {hasQuery && !isLoading && !error && results.length > 0 && (
          <ul className="space-y-2" role="list">
            {results.map((item) => (
              <li key={item.lessonId}>
                <button
                  type="button"
                  onClick={() => onResultClick?.(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onResultClick?.(item);
                    }
                  }}
                  className="w-full rounded-md border border-border p-3 text-left hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label={`${item.lessonName} — ${item.trailName}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{item.lessonName}</span>
                    {item.isDraft && (
                      <span
                        className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800"
                        aria-label={t.draftBadge}
                      >
                        {t.draftBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.trailName} &rsaquo; {item.moduleName}
                  </p>
                  <p className="mt-1 text-xs text-foreground/80">
                    <SearchHighlight snippet={item.snippet} />
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
