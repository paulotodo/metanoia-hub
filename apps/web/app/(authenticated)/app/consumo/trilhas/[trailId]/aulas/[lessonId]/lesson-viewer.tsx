'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLesson } from '@/lib/api/hooks/use-lesson';
import { useTrailModules, useModuleLessons } from '@/lib/api/hooks/use-trail-structure';
import { RichTextEditor } from '@/components/content/rich-text-editor';
import messages from '../../../../../../../../messages/pt-BR.json';

// Dynamic import with ssr:false — Plyr requires DOM (task 4.3)
const PlyrVideoPlayer = dynamic(
  () =>
    import('@/components/content/plyr-video-player').then(
      (m) => m.PlyrVideoPlayer,
    ),
  { ssr: false, loading: () => <div className="aspect-video bg-black rounded-lg motion-safe:animate-pulse" aria-label="Carregando player..." /> },
);

const t = messages.lessonViewer;

// ---------------------------------------------------------------------------
// LessonViewer — Client Component for consuming lesson content
// Switches on contentType: video | rich_text | pdf_doc | external_link
// ---------------------------------------------------------------------------

interface LessonViewerProps {
  trailId: string;
  moduleId: string;
  lessonId: string;
}

interface OrderedItem {
  id: string;
  order: number;
}

/** Sorts by `order` ascending (stable; does not mutate input). */
function byOrder<T extends OrderedItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function LessonViewer({ trailId, moduleId, lessonId }: LessonViewerProps) {
  const { data: lesson, isPending, isError } = useLesson(trailId, moduleId, lessonId);
  const { data: modulesData } = useTrailModules(trailId);
  const { data: currentModuleLessons } = useModuleLessons(trailId, moduleId);
  const nextButtonRef = useRef<HTMLAnchorElement>(null);

  // --- Next-lesson navigation (real fan-out; lessons are fetched per module) ---
  const modules = byOrder(modulesData?.data ?? []);
  const currentModuleIdx = modules.findIndex((m) => m.id === moduleId);
  const nextModule =
    currentModuleIdx >= 0 ? modules[currentModuleIdx + 1] : undefined;

  const currentLessons = byOrder(currentModuleLessons?.data ?? []);
  const currentLessonIdx = currentLessons.findIndex((l) => l.id === lessonId);
  const nextInModule =
    currentLessonIdx >= 0 ? currentLessons[currentLessonIdx + 1] : undefined;

  // Only fetch the next module's lessons when the current lesson is the last of
  // its module (otherwise the hook stays disabled via an empty moduleId).
  const isLastInModule = currentLessonIdx >= 0 && !nextInModule;
  const { data: nextModuleLessons } = useModuleLessons(
    trailId,
    isLastInModule && nextModule ? nextModule.id : '',
  );
  const nextModuleFirst =
    isLastInModule && nextModule
      ? byOrder(nextModuleLessons?.data ?? [])[0]
      : undefined;

  const next = nextInModule
    ? { lessonId: nextInModule.id, moduleId }
    : nextModuleFirst && nextModule
      ? { lessonId: nextModuleFirst.id, moduleId: nextModule.id }
      : null;

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-body text-text-secondary" role="status" aria-live="polite">
          {t.loading}
        </p>
      </div>
    );
  }

  if (isError || !lesson) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-body text-care-alert" role="alert">
          {isError ? t.error : t.notFound}
        </p>
      </div>
    );
  }

  const nextHref = next
    ? `/app/consumo/trilhas/${trailId}/aulas/${next.lessonId}?moduleId=${next.moduleId}`
    : null;
  const backHref = `/app/consumo/trilhas/${trailId}`;

  return (
    <main
      className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6"
      aria-label={t.a11y.lessonContent}
    >
      {/* Lesson heading — h1 unique per page (CHK-A11Y-001) */}
      <h1 className="text-2xl font-bold text-text-primary">{lesson.name}</h1>

      {/* Content area — switches on contentType */}
      <section aria-label={t.contentTypes[lesson.contentType]}>
        {lesson.contentType === 'video' && lesson.contentUrl && (
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black" id="lesson-video-container">
            <PlyrVideoPlayer
              src={lesson.contentUrl}
              title={lesson.name}
              durationSeconds={(lesson.estimatedDurationMinutes ?? 0) * 60}
              nextButtonRef={nextButtonRef}
              className="w-full h-full"
            />
          </div>
        )}

        {lesson.contentType === 'rich_text' && (
          // Reuse the canonical RichTextViewer (RichTextEditor readOnly) instead of
          // re-implementing dangerouslySetInnerHTML inline. Headings inside the
          // content start at h2 (h1 = lesson.name above — CHK-A11Y-002).
          <RichTextEditor value={lesson.contentBody} readOnly className="prose-lg" />
        )}

        {lesson.contentType === 'pdf_doc' && lesson.contentUrl && (
          <div className="flex flex-col gap-4">
            <iframe
              src={lesson.contentUrl}
              className="w-full h-[70vh] rounded-lg border border-border-default"
              title={lesson.name}
              aria-label={lesson.name}
            />
            <a
              href={lesson.contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-interactive-primary underline text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 rounded"
            >
              {t.navigation.backToTrail}
              <span className="sr-only">{t.a11y.externalLinkWarning}</span>
            </a>
          </div>
        )}

        {lesson.contentType === 'external_link' && lesson.contentUrl && (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <p className="text-body text-text-secondary">{t.contentTypes.external_link}</p>
            <a
              href={lesson.contentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center rounded-lg bg-interactive-primary px-6 text-sm font-semibold text-text-inverse hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 motion-safe:transition-colors"
            >
              Acessar conteúdo
              <span className="sr-only">{t.a11y.externalLinkWarning}</span>
            </a>
          </div>
        )}

        {/* Fallback for unknown/unsupported contentType or missing URL */}
        {(() => {
          const known = ['video', 'rich_text', 'pdf_doc', 'external_link'];
          const renderable =
            (lesson.contentType === 'video' && lesson.contentUrl) ||
            (lesson.contentType === 'rich_text') ||
            (lesson.contentType === 'pdf_doc' && lesson.contentUrl) ||
            (lesson.contentType === 'external_link' && lesson.contentUrl);
          if (renderable && known.includes(lesson.contentType)) return null;
          return (
            <p className="text-body text-text-secondary" role="status">
              {t.unsupportedContent}
            </p>
          );
        })()}
      </section>

      {/* Navigation bar */}
      <nav
        className="flex items-center justify-between gap-4 pt-4 border-t border-border-default"
        aria-label="Navegação entre aulas"
      >
        <Link
          href={backHref}
          className="inline-flex h-10 items-center rounded-lg border border-border-default px-4 text-sm font-medium text-text-secondary hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 motion-safe:transition-colors"
        >
          {t.navigation.backToTrail}
        </Link>

        {nextHref ? (
          <Link
            ref={nextButtonRef}
            href={nextHref}
            className="inline-flex h-11 items-center rounded-lg bg-interactive-primary px-6 text-sm font-semibold text-text-inverse hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 motion-safe:transition-colors"
          >
            {t.navigation.nextLesson}
          </Link>
        ) : (
          <Link
            ref={nextButtonRef}
            href={backHref}
            className="inline-flex h-11 items-center rounded-lg bg-interactive-primary px-6 text-sm font-semibold text-text-inverse hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 motion-safe:transition-colors"
          >
            {t.navigation.completeTrail}
          </Link>
        )}
      </nav>
    </main>
  );
}
