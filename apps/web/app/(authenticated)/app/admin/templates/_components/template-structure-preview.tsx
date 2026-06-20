'use client';

import { useState } from 'react';
import type { ContentTemplate } from '@metanoia/types';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.templates.preview;

interface TemplateStructurePreviewProps {
  template: ContentTemplate;
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  video: 'Vídeo',
  rich_text: 'Texto rico',
  pdf_doc: 'PDF',
  external_link: 'Link externo',
};

const CONTENT_TYPE_ICON: Record<string, string> = {
  video: '🎬',
  rich_text: '📝',
  pdf_doc: '📄',
  external_link: '🔗',
};

export function TemplateStructurePreview({ template }: TemplateStructurePreviewProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const modules = template.structure.modules;

  if (modules.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-4" role="status">
        {t.noModules}
      </p>
    );
  }

  function toggleModule(idx: number) {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div className="space-y-2" role="tree" aria-label={t.title}>
      {modules.map((mod, idx) => {
        const isOpen = expanded[idx] ?? false;
        const lessonCount = mod.lessons?.length ?? 0;

        return (
          <div key={idx} role="treeitem" aria-expanded={isOpen}>
            <button
              type="button"
              onClick={() => toggleModule(idx)}
              className="w-full flex items-center gap-2 text-left rounded-md p-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-interactive-focus)] transition"
              aria-expanded={isOpen}
              aria-controls={`module-lessons-${idx}`}
            >
              <span aria-hidden="true" className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                ▶
              </span>
              <span className="flex-1 truncate">{mod.name}</span>
              <span className="text-xs text-text-secondary shrink-0">
                {lessonCount} {lessonCount === 1 ? 'lição' : 'lições'}
              </span>
            </button>

            {isOpen && (
              <ul
                id={`module-lessons-${idx}`}
                role="group"
                className="mt-1 ml-6 space-y-1"
              >
                {(mod.lessons ?? []).map((lesson, lIdx) => (
                  <li
                    key={lIdx}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs text-text-secondary"
                    role="treeitem"
                  >
                    <span
                      aria-label={CONTENT_TYPE_LABEL[lesson.contentType] ?? lesson.contentType}
                      title={CONTENT_TYPE_LABEL[lesson.contentType] ?? lesson.contentType}
                    >
                      {CONTENT_TYPE_ICON[lesson.contentType] ?? '📄'}
                    </span>
                    <span className="flex-1 truncate">{lesson.name}</span>
                    {lesson.estimatedDurationMinutes && (
                      <span className="shrink-0 text-[10px] text-text-secondary">
                        {lesson.estimatedDurationMinutes}min
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
