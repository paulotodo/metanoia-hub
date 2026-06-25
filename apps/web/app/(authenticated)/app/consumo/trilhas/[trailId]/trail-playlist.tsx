'use client';

import { useState, useCallback, useRef } from 'react';
import type { LessonStatus } from '@metanoia/types';
import { useTrail, useTrailModules } from '@/lib/api/hooks/use-trail-structure';
import { useTrailProgress, useResumeLesson } from '@/lib/api/hooks/use-progress';
import { TrailPlaylistHeader } from './trail-playlist-header';
import { TrailPlaylistSkeleton } from './trail-playlist-skeleton';
import { TrailPlaylistEmpty } from './trail-playlist-empty';
import { TrailPlaylistError } from './trail-playlist-error';
import { ModuleAccordionItem } from './module-accordion-item';
import { LazyModuleMount } from './lazy-module-mount';

// ---------------------------------------------------------------------------
// TrailPlaylist — main orchestration component (spec §FR-001..FR-010, FR-014)
// ---------------------------------------------------------------------------

interface TrailPlaylistProps {
  trailId: string;
  onLessonSelect: (lessonId: string) => void;
}

/** Approximate height of a collapsed module for IntersectionObserver placeholder */
const MODULE_PLACEHOLDER_HEIGHT = 80;

export function TrailPlaylist({ trailId, onLessonSelect }: TrailPlaylistProps) {
  // Parallel queries for structure (FR-010, dec-006)
  const trailQuery = useTrail(trailId);
  const modulesQuery = useTrailModules(trailId);
  const progressQuery = useTrailProgress(trailId);
  const resumeQuery = useResumeLesson(trailId);

  // Accordion expansion state — Set of expanded module IDs
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Keyboard navigation ref for roving focus
  const listRef = useRef<HTMLDivElement>(null);

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  // Loading state: show skeleton while structure queries are loading
  const isLoading = trailQuery.isLoading || modulesQuery.isLoading;
  if (isLoading) {
    return <TrailPlaylistSkeleton />;
  }

  // Error state: any structure query failed → show error with retry
  const hasError = trailQuery.isError || modulesQuery.isError;
  if (hasError) {
    const handleRetry = () => {
      if (trailQuery.isError) void trailQuery.refetch();
      if (modulesQuery.isError) void modulesQuery.refetch();
    };
    return <TrailPlaylistError onRetry={handleRetry} />;
  }

  const modules = modulesQuery.data?.data ?? [];

  // Empty state: trail has no modules (FR-014)
  if (modules.length === 0) {
    return <TrailPlaylistEmpty />;
  }

  // Build progressByLessonId map from progress API response
  const progressByLessonId: Record<string, LessonStatus> = {};
  if (progressQuery.data?.data) {
    for (const mod of progressQuery.data.data.modules) {
      for (const lesson of mod.lessons) {
        progressByLessonId[lesson.lessonId] = lesson.status;
      }
    }
  }

  // Derive active lesson: first in_progress → then resume endpoint
  let activeLessonId: string | null = null;
  for (const [lessonId, status] of Object.entries(progressByLessonId)) {
    if (status === 'in_progress') {
      activeLessonId = lessonId;
      break;
    }
  }
  if (!activeLessonId && resumeQuery.data?.data.lessonId) {
    activeLessonId = resumeQuery.data.data.lessonId;
  }

  // Roving keyboard focus: ArrowUp/ArrowDown between interactive elements
  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    const focusableSelector = [
      '[data-testid="module-accordion-header"]',
      '[data-testid="lesson-row"]',
    ].join(',');

    const focusables = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    );
    if (focusables.length === 0) return;

    const currentIndex = focusables.findIndex((el) => el === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = focusables[currentIndex + 1] ?? focusables[0];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = focusables[currentIndex - 1] ?? focusables[focusables.length - 1];
      prev?.focus();
    }
  };

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      data-testid="trail-playlist"
      data-trail-id={trailId}
    >
      {/* Overall progress header (FR-006) */}
      <TrailPlaylistHeader trailId={trailId} />

      {/* Module list with roving focus navigation (FR-011) */}
      <div
        ref={listRef}
        className="flex flex-col gap-2 p-4"
        onKeyDown={handleListKeyDown}
        role="list"
        aria-label={trailQuery.data?.name ?? 'Módulos da trilha'}
      >
        {modules
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((module, index) => {
            const isFirstModule = index === 0;
            const isExpanded = expandedModules.has(module.id);

            const item = (
              <div role="listitem" key={module.id}>
                <ModuleAccordionItem
                  module={module}
                  trailId={trailId}
                  progressByLessonId={progressByLessonId}
                  activeLesson={activeLessonId}
                  onLessonSelect={onLessonSelect}
                  isExpanded={isExpanded}
                  onToggle={() => toggleModule(module.id)}
                  moduleIndex={index + 1}
                  totalModules={modules.length}
                />
              </div>
            );

            // First module: eager mount; rest: lazy via IntersectionObserver (FR-009)
            if (isFirstModule) {
              return item;
            }

            return (
              <LazyModuleMount
                key={module.id}
                placeholderHeight={MODULE_PLACEHOLDER_HEIGHT}
              >
                {item}
              </LazyModuleMount>
            );
          })}
      </div>
    </div>
  );
}
