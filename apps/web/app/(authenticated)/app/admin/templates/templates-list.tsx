'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@metanoia/ui';
import { useTemplatesList } from '@/lib/api/hooks/use-templates';
import { TemplateCard } from './_components/template-card';
import messages from '../../../../../messages/pt-BR.json';

const t = messages.templates;

type ScopeFilter = 'all' | 'platform' | 'tenant';
type SortOption = 'name' | '-name' | 'createdAt' | '-createdAt';

function TemplatesSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label={t.list.loading}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 h-40 animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function TemplatesList() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [sort, setSort] = useState<SortOption>('name');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isPending, isError, refetch } = useTemplatesList({
    search: debouncedSearch || undefined,
    scope: scope === 'all' ? undefined : scope,
    sort,
    page,
    pageSize: 20,
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const templates = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  function handleUse(id: string) {
    router.push(`/app/admin/trilhas/nova?templateId=${id}`);
  }

  function handlePreview(id: string) {
    router.push(`/app/admin/templates/${id}`);
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            type="search"
            placeholder={t.filter.searchPlaceholder}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label={t.filter.searchPlaceholder}
            className="max-w-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Scope filter */}
          <div role="group" aria-label="Filtrar por origem" className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(['all', 'platform', 'tenant'] as ScopeFilter[]).map((s) => {
              const labels: Record<ScopeFilter, string> = {
                all: t.scope.all,
                platform: t.scope.platform,
                tenant: t.scope.myTemplates,
              };
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setScope(s); setPage(1); }}
                  aria-pressed={scope === s}
                  className={`px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] ${
                    scope === s
                      ? 'bg-[var(--color-interactive-primary)] text-[var(--color-text-inverse)]'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--muted)]'
                  }`}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
            aria-label={t.filter.sortLabel}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)]"
          >
            <option value="name">{t.filter.sort.nameAsc}</option>
            <option value="-name">{t.filter.sort.nameDesc}</option>
            <option value="-createdAt">{t.filter.sort.newest}</option>
            <option value="createdAt">{t.filter.sort.oldest}</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isPending && <TemplatesSkeleton />}

      {isError && (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-text-secondary">{t.list.error}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex items-center rounded-md bg-[var(--color-interactive-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-interactive-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
          >
            {t.list.retry}
          </button>
        </div>
      )}

      {!isPending && !isError && templates.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-text-secondary">
            {debouncedSearch ? t.list.emptySearch : t.list.empty}
          </p>
        </div>
      )}

      {!isPending && !isError && templates.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={handleUse}
                onPreview={handlePreview}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav aria-label="Paginação de modelos" className="flex items-center justify-between pt-2">
              <p className="text-xs text-text-secondary">
                {total} {total === 1 ? 'modelo' : 'modelos'} encontrados
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
                  aria-label="Página anterior"
                >
                  Anterior
                </button>
                <span className="flex items-center text-xs text-text-secondary px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
                  aria-label="Próxima página"
                >
                  Próxima
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
