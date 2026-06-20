'use client';

import type { ContentTemplate } from '@metanoia/types';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.templates;

interface TemplateCardProps {
  template: ContentTemplate;
  onUse: (id: string) => void;
  onPreview: (id: string) => void;
}

function getScopeModuleCount(template: ContentTemplate): number {
  return template.structure.modules.length;
}

function getScopeLessonCount(template: ContentTemplate): number {
  return template.structure.modules.reduce(
    (acc, mod) => acc + (mod.lessons?.length ?? 0),
    0,
  );
}

export function TemplateCard({ template, onUse, onPreview }: TemplateCardProps) {
  const isPlatform = template.scope === 'platform';
  const moduleCount = getScopeModuleCount(template);
  const lessonCount = getScopeLessonCount(template);

  return (
    <article
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3 hover:border-[var(--color-brand-teal)] transition"
      aria-label={`${template.name} — ${isPlatform ? t.scope.platform : t.scope.tenant}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {template.name}
          </h3>
          {template.description && (
            <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
              {template.description}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
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
      </div>

      <div className="flex gap-3 text-xs text-text-secondary">
        <span>
          <span aria-label={`${moduleCount} módulos`}>
            {moduleCount} {moduleCount === 1 ? 'módulo' : 'módulos'}
          </span>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <span aria-label={`${lessonCount} lições`}>
            {lessonCount} {lessonCount === 1 ? 'lição' : 'lições'}
          </span>
        </span>
        <span aria-hidden="true">·</span>
        <span>v{template.version}</span>
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        <button
          type="button"
          onClick={() => onPreview(template.id)}
          className="flex-1 inline-flex items-center justify-center rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
          aria-label={`Visualizar estrutura do modelo ${template.name}`}
        >
          Visualizar
        </button>
        <button
          type="button"
          onClick={() => onUse(template.id)}
          className="flex-1 inline-flex items-center justify-center rounded-md bg-[var(--color-interactive-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-interactive-primary)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
          aria-label={`${t.list.useTemplate}: ${template.name}`}
        >
          {t.list.useTemplate}
        </button>
      </div>
    </article>
  );
}
