'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTemplateById, useTemplateVersions, useDeleteTemplate } from '@/lib/api/hooks/use-templates';
import { TemplateStructurePreview } from '../_components/template-structure-preview';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.templates;

interface Props {
  params: Promise<{ id: string }>;
}

export default function TemplateDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();

  const { data: template, isPending, isError } = useTemplateById(id);
  const { data: versionsData } = useTemplateVersions(
    id,
    template?.sourceTrailId ?? null,
  );
  const deleteMutation = useDeleteTemplate(id);

  if (isPending) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-64 rounded bg-[var(--muted)]" aria-hidden="true" />
          <div className="h-4 w-96 rounded bg-[var(--muted)]" aria-hidden="true" />
          <div className="h-40 rounded-lg border border-[var(--border)] bg-[var(--muted)]" aria-hidden="true" />
        </div>
      </main>
    );
  }

  if (isError || !template) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
          <p className="text-display text-[var(--color-text-primary)]">{t.crud.notFound}</p>
          <p className="text-body text-text-secondary">{t.crud.notFoundDesc}</p>
          <Link
            href="/app/admin/templates"
            className="inline-flex items-center rounded-md bg-[var(--color-interactive-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-interactive-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
          >
            {t.crud.backToList}
          </Link>
        </div>
      </main>
    );
  }

  const isPlatform = template.scope === 'platform';
  const versions = versionsData?.data ?? [];

  function handleUseTemplate() {
    if (!template) return;
    router.push(`/app/admin/trilhas/nova?templateId=${template.id}`);
  }

  function handleEdit() {
    if (!template) return;
    router.push(`/app/admin/templates/${template.id}/editar`);
  }

  function handleDelete() {
    if (!window.confirm(t.crud.confirmDelete)) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        router.push('/app/admin/templates');
      },
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      <nav aria-label="Navegação" className="flex items-center gap-2 text-sm text-text-secondary">
        <Link
          href="/app/admin/templates"
          className="hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] rounded"
        >
          {t.page.title}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--color-text-primary)]">{template.name}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-display" data-autofocus>
              {template.name}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-[10px] font-medium text-text-secondary">
              <span aria-hidden="true">{isPlatform ? '🏛' : '🏠'}</span>
              <span className="ml-1">{isPlatform ? t.scope.platform : t.scope.tenant}</span>
            </span>
            {isPlatform && (
              <span className="inline-flex items-center rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                {t.badge.readOnly}
              </span>
            )}
          </div>
          {template.description && (
            <p className="mt-2 text-body text-text-secondary">{template.description}</p>
          )}
          <p className="mt-1 text-xs text-text-secondary">
            v{template.version} ·{' '}
            {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
              new Date(template.createdAt),
            )}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleUseTemplate}
            className="inline-flex items-center rounded-md bg-[var(--color-interactive-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-interactive-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
            aria-label={`${t.list.useTemplate}: ${template.name}`}
          >
            {t.list.useTemplate}
          </button>

          {!isPlatform && (
            <>
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
                aria-label={`${t.crud.edit}: ${template.name}`}
              >
                {t.crud.edit}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center rounded-md border border-[var(--color-state-danger,_#ef4444)] px-4 py-2 text-sm font-medium text-[var(--color-state-danger,_#ef4444)] hover:bg-[var(--color-state-danger,_#ef4444)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] disabled:opacity-50 disabled:cursor-not-allowed transition"
                aria-label={`${t.crud.delete}: ${template.name}`}
              >
                {deleteMutation.isPending ? 'Excluindo...' : t.crud.delete}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Structure Preview */}
      <section aria-labelledby="structure-heading" className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2
          id="structure-heading"
          className="text-sm font-semibold text-[var(--color-text-primary)] mb-4"
        >
          {t.preview.title}
        </h2>
        <TemplateStructurePreview template={template} />
      </section>

      {/* Version History */}
      {template.sourceTrailId && (
        <section aria-labelledby="versions-heading" className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
          <h2
            id="versions-heading"
            className="text-sm font-semibold text-[var(--color-text-primary)] mb-4"
          >
            {t.preview.versions}
          </h2>
          {versions.length === 0 ? (
            <p className="text-sm text-text-secondary">{t.preview.noVersions}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="font-medium text-[var(--color-text-primary)]">v{v.version}</span>
                  <span className="text-text-secondary">
                    {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
                      new Date(v.createdAt),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isPlatform && (
        <section aria-labelledby="versions-heading-platform" className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
          <h2
            id="versions-heading-platform"
            className="text-sm font-semibold text-[var(--color-text-primary)] mb-2"
          >
            {t.preview.versions}
          </h2>
          <p className="text-sm text-text-secondary">{t.preview.noHistoryPlatform}</p>
        </section>
      )}
    </main>
  );
}
