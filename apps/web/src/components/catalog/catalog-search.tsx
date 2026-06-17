'use client';

import {
  useId,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { useSearch } from '@/lib/api/hooks/use-search';
import { useAsyncAnnouncer } from '@/components/a11y/async-announcer';
import { SearchHighlight } from '@/components/search/search-highlight';
import messages from '../../../messages/pt-BR.json';

const t = messages.catalog;

// ---------------------------------------------------------------------------
// FilterDropdown — FR-016: Enter/Space abre; Arrow Up/Down navega; Escape fecha
// ---------------------------------------------------------------------------
interface FilterOption { label: string; value: string }

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}

function FilterDropdown({ label, options, value, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const buttonId = useId();

  const currentLabel = options.find((o) => o.value === value)?.label ?? label;

  function openMenu() {
    setOpen(true);
    const idx = options.findIndex((o) => o.value === value);
    setActiveIdx(idx >= 0 ? idx : 0);
  }

  function closeMenu() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu();
    }
  }

  function handleListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % options.length);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + options.length) % options.length);
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < options.length) {
        // safe: bounds checked above
        const chosen = options[activeIdx];
        if (chosen) { onChange(chosen.value); }
        closeMenu();
      }
    }
    if (e.key === 'Tab') {
      closeMenu();
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t.filterDropdown.open.replace('{label}', label)}: ${currentLabel}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleButtonKeyDown}
        className={[
          'flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm',
          'hover:bg-accent/50',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        ].join(' ')}
      >
        <span>{label}:</span>
        <span className="font-medium">{currentLabel}</span>
        <span aria-hidden="true" className="ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          aria-labelledby={buttonId}
          tabIndex={0}
          // autoFocus: listbox recebe foco imediatamente ao abrir (FR-016)
          autoFocus
          onKeyDown={handleListKeyDown}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) closeMenu();
          }}
          className="absolute z-50 mt-1 min-w-[8rem] rounded-md border border-border bg-background shadow-md focus:outline-none"
        >
          {options.map((opt, idx) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); closeMenu(); }}
              className={[
                'cursor-pointer px-3 py-1.5 text-sm',
                idx === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                opt.value === value ? 'font-semibold' : '',
              ].join(' ')}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paginação — FR-018
// ---------------------------------------------------------------------------
interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pageLabel = t.pageOf.replace('{current}', String(page)).replace('{total}', String(totalPages));

  return (
    <nav aria-label={t.filtersLabel} className="flex items-center justify-center gap-3 mt-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        aria-label={t.prevPage}
        aria-disabled={page <= 1}
        className={[
          'rounded-md border border-border px-3 py-1.5 text-sm',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent/50',
        ].join(' ')}
      >
        {t.prevPage}
      </button>
      <span className="text-sm text-muted-foreground" aria-current="page">{pageLabel}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        aria-label={t.nextPage}
        aria-disabled={page >= totalPages}
        className={[
          'rounded-md border border-border px-3 py-1.5 text-sm',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          page >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent/50',
        ].join(' ')}
      >
        {t.nextPage}
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// CatalogSearch — componente principal US5
// ---------------------------------------------------------------------------
const PAGE_SIZE = 10;

const CATEGORY_OPTIONS: FilterOption[] = [
  { label: t.filterAll, value: '' },
  { label: 'Discipulado', value: 'discipulado' },
  { label: 'Liderança', value: 'lideranca' },
  { label: 'Família', value: 'familia' },
  { label: 'Devocionais', value: 'devocionais' },
];

const STATUS_OPTIONS: FilterOption[] = [
  { label: t.filterAll, value: '' },
  { label: t.trailCard.status.not_started, value: 'not_started' },
  { label: t.trailCard.status.in_progress, value: 'in_progress' },
  { label: t.trailCard.status.completed, value: 'completed' },
];

export function CatalogSearch() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [rawQuery, setRawQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const statusRegionId = useId();
  const resultsId = useId();

  // dec-015: manter foco no campo de busca; anunciar contagem via role=status
  const { announce } = useAsyncAnnouncer();

  // 300ms debounce na query
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setRawQuery(v);
      setPage(1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setDebouncedQuery(v), 300);
    },
    [],
  );

  const { data, isLoading, error } = useSearch(debouncedQuery);

  // Filtrar client-side por category/status (API retorna dados da busca textual)
  const allResults = data?.data ?? [];
  const filtered = allResults.filter((item) => {
    const itemAny = item as unknown as Record<string, string>;
    if (category && itemAny['category'] !== category) return false;
    if (status && itemAny['status'] !== status) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageResults = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasQuery = debouncedQuery.trim().length > 0;

  // dec-015: anunciar contagem via useAsyncAnnouncer (polite), NÃO mover foco
  const prevLoadingRef = useRef(false);
  if (prevLoadingRef.current && !isLoading && hasQuery) {
    const msg = t.resultsAnnounce
      .replace('{count}', String(filtered.length))
      .replace('{query}', debouncedQuery.trim());
    announce(msg);
  }
  prevLoadingRef.current = isLoading;

  return (
    <section aria-label={t.title} className="space-y-4">
      {/* FR-015: campo de busca é o primeiro focável da seção */}
      <div role="search" className="space-y-3">
        <label htmlFor="catalog-search-input" className="sr-only">
          {t.searchPlaceholder}
        </label>
        <input
          ref={searchInputRef}
          id="catalog-search-input"
          type="search"
          value={rawQuery}
          onChange={handleQueryChange}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          aria-busy={isLoading}
          aria-controls={resultsId}
          autoComplete="off"
          className={[
            'w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          ].join(' ')}
        />

        {/* FR-016: filtros acessíveis por teclado */}
        <div
          role="group"
          aria-label={t.filtersLabel}
          className="flex flex-wrap gap-2"
        >
          <FilterDropdown
            label={t.filterCategory}
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(v) => { setCategory(v); setPage(1); }}
          />
          <FilterDropdown
            label={t.filterStatus}
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
          />
        </div>
      </div>

      {/* dec-015: região role=status aria-live=polite para anunciar contagem
          (complementa o useAsyncAnnouncer — visualmente oculta) */}
      <div
        id={statusRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="catalog-result-status"
      >
        {hasQuery && !isLoading && !error
          ? t.resultsCount.replace('{count}', String(filtered.length))
          : ''}
      </div>

      {/* Resultados */}
      <div id={resultsId} aria-label={t.title}>
        {hasQuery && isLoading && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t.loadingResults}
          </p>
        )}

        {hasQuery && error && (
          <p className="text-sm text-destructive" role="alert">
            {messages.search.emptyState}
          </p>
        )}

        {hasQuery && !isLoading && !error && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">{t.noResults}</p>
        )}

        {/* FR-017: cards navegáveis — lista de <a> focáveis */}
        {pageResults.length > 0 && (
          <ul role="list" aria-label={t.title} className="space-y-2">
            {pageResults.map((item) => (
              <li key={item.lessonId}>
                <a
                  href={`/app/consumo/trilhas/${item.trailId}`}
                  aria-label={t.trailCard.activate.replace('{name}', item.lessonName)}
                  onKeyDown={(e) => {
                    if (e.key === ' ') {
                      e.preventDefault();
                      window.location.href = `/app/consumo/trilhas/${item.trailId}`;
                    }
                  }}
                  className={[
                    'block rounded-lg border border-border bg-background p-4',
                    'hover:bg-accent/50',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'transition-colors',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{item.lessonName}</span>
                    {item.isDraft && (
                      <span
                        className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800"
                        aria-label={messages.search.draftBadge}
                      >
                        {messages.search.draftBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.trailName}
                  </p>
                  <p className="mt-1 text-xs text-foreground/80">
                    <SearchHighlight snippet={item.snippet} />
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* FR-018: paginação alcançável via Tab */}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>
    </section>
  );
}
