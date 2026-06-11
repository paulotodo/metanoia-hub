'use client';

import { useId } from 'react';
import type { ModuleResponse, LessonStatus } from '@metanoia/types';
import { TrailProgressBar } from '@/components/content/trail-progress-bar';
import { useModuleLessons } from '@/lib/api/hooks/use-trail-structure';
import { deriveLockedLessons } from './use-locked-lessons';
import { LessonRow } from './lesson-row';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.trailPlaylist;

// ---------------------------------------------------------------------------
// ModuleAccordionItem — collapsible accordion entry for a single module
// ---------------------------------------------------------------------------

interface ModuleAccordionItemProps {
  module: ModuleResponse;
  trailId: string;
  /** Map of lessonId → status from progress API */
  progressByLessonId: Record<string, LessonStatus>;
  activeLesson: string | null;
  onLessonSelect: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ModuleAccordionItem({
  module,
  trailId,
  progressByLessonId,
  activeLesson,
  onLessonSelect,
  isExpanded,
  onToggle,
}: ModuleAccordionItemProps) {
  const regionId = useId();

  const { data: lessonsData, isLoading } = useModuleLessons(trailId, module.id);
  const lessons = lessonsData?.data ?? [];

  // Calculate module completion percent
  const totalLessons = lessons.length;
  const completedLessons = lessons.filter(
    (l) => (progressByLessonId[l.id] ?? 'not_started') === 'completed',
  ).length;
  const completionPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Derive lock state for each lesson
  const lockStates = deriveLockedLessons(module, lessons, progressByLessonId);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="border rounded-xl overflow-hidden" data-testid="module-accordion-item" data-module-id={module.id}>
      {/* Module header */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={regionId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center gap-3 p-5 min-h-11 text-left bg-card hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        data-testid="module-accordion-header"
      >
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm truncate block">{module.name}</span>
          {/* Completion percent always visible even when collapsed (FR-004) */}
          <div className="mt-1">
            <TrailProgressBar
              progressPercent={completionPercent}
              label={`Módulo ${module.name} — ${completionPercent}% concluído`}
              className="max-w-xs"
            />
          </div>
        </div>
        {/* Chevron icon */}
        <svg
          className={`shrink-0 w-4 h-4 text-muted-foreground transition-transform duration-200 ease-out ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Lesson list region — animated with transition-all duration-200 ease-out (CHK005 resolution) */}
      <div
        id={regionId}
        role="region"
        aria-label={`Aulas do módulo ${module.name}`}
        className={`transition-all duration-200 ease-out overflow-hidden ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        {isExpanded && (
          <div className="divide-y divide-border">
            {isLoading && (
              <div className="p-5 space-y-3" aria-busy="true">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-11 bg-muted motion-safe:animate-pulse rounded-xl" />
                ))}
              </div>
            )}

            {/* Empty state — CHK033 resolution (1.1.5) */}
            {!isLoading && lessons.length === 0 && (
              <div className="p-5 text-sm text-muted-foreground" data-testid="module-empty">
                {t.module.empty}
              </div>
            )}

            {/* Lesson rows */}
            {!isLoading &&
              lessons
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((lesson) => {
                  const lockState = lockStates[lesson.id] ?? { locked: false, reason: null };
                  return (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      lessonStatus={progressByLessonId[lesson.id] ?? 'not_started'}
                      isActive={activeLesson === lesson.id}
                      isLocked={lockState.locked}
                      lockReason={lockState.reason}
                      onSelect={onLessonSelect}
                    />
                  );
                })}
          </div>
        )}
      </div>
    </div>
  );
}
