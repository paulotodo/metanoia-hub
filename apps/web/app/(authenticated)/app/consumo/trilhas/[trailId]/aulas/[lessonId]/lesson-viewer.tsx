'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLesson } from '@/lib/api/hooks/use-lesson';
import { useTrailModules } from '@/lib/api/hooks/use-trail-structure';
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

/**
 * Finds next lesson across modules given currentLessonId and moduleId.
 * Returns { nextLessonId, nextModuleId } or null if this is the last lesson.
 */
function findNextLesson(
  modules: Array<{ id: string; lessons?: Array<{ id: string }> }>,
  currentModuleId: string,
  currentLessonId: string,
): { nextLessonId: string; nextModuleId: string } | null {
  for (let mi = 0; mi < modules.length; mi++) {
    const mod = modules[mi];
    if (!mod || mod.id !== currentModuleId) continue;
    const lessons = mod.lessons ?? [];
    for (let li = 0; li < lessons.length; li++) {
      const lesson = lessons[li];
      if (!lesson || lesson.id !== currentLessonId) continue;
      // Next lesson in same module
      const nextLesson = lessons[li + 1];
      if (nextLesson) {
        return { nextLessonId: nextLesson.id, nextModuleId: mod.id };
      }
      // First lesson of next module
      const nextMod = modules[mi + 1];
      if (nextMod) {
        const nextModFirstLesson = (nextMod.lessons ?? [])[0];
        if (nextModFirstLesson) {
          return { nextLessonId: nextModFirstLesson.id, nextModuleId: nextMod.id };
        }
      }
      return null; // last lesson of last module
    }
  }
  return null;
}

export function LessonViewer({ trailId, moduleId, lessonId }: LessonViewerProps) {
  const { data: lesson, isPending, isError } = useLesson(trailId, moduleId, lessonId);
  // For navigation: get trail structure to find next lesson
  const { data: modulesData } = useTrailModules(trailId);
  const nextButtonRef = useRef<HTMLAnchorElement>(null);

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

  // Build next-lesson navigation
  const modules = (modulesData?.data ?? []).map((m) => ({
    id: m.id,
    // lessons not yet loaded in modulesData — navigation relies on trailId+moduleId context
    lessons: [] as Array<{ id: string }>,
  }));
  const next = moduleId
    ? findNextLesson(modules, moduleId, lessonId)
    : null;

  const nextHref = next
    ? `/app/consumo/trilhas/${trailId}/aulas/${next.nextLessonId}?moduleId=${next.nextModuleId}`
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

        {lesson.contentType === 'rich_text' && lesson.contentBody && (
          <div
            className="prose prose-lg max-w-none text-text-primary"
            // headings inside rich_text start at h2 (h1 = lesson.name above — CHK-A11Y-002)
            dangerouslySetInnerHTML={{ __html: lesson.contentBody }}
            aria-label={lesson.name}
          />
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
              className="inline-flex items-center gap-2 text-interactive-primary underline text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus rounded"
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
              className="inline-flex h-11 items-center rounded-lg bg-interactive-primary px-6 text-sm font-semibold text-text-inverse hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus motion-safe:transition-colors"
            >
              Acessar conteúdo
              <span className="sr-only">{t.a11y.externalLinkWarning}</span>
            </a>
          </div>
        )}
      </section>

      {/* Navigation bar */}
      <nav
        className="flex items-center justify-between gap-4 pt-4 border-t border-border-default"
        aria-label="Navegação entre aulas"
      >
        <Link
          href={backHref}
          className="inline-flex h-10 items-center rounded-lg border border-border-default px-4 text-sm font-medium text-text-secondary hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus motion-safe:transition-colors"
        >
          {t.navigation.backToTrail}
        </Link>

        {nextHref ? (
          <Link
            ref={nextButtonRef}
            href={nextHref}
            className="inline-flex h-11 items-center rounded-lg bg-interactive-primary px-6 text-sm font-semibold text-text-inverse hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus motion-safe:transition-colors"
          >
            {t.navigation.nextLesson}
          </Link>
        ) : (
          <Link
            ref={nextButtonRef}
            href={backHref}
            className="inline-flex h-11 items-center rounded-lg bg-interactive-primary px-6 text-sm font-semibold text-text-inverse hover:bg-interactive-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus motion-safe:transition-colors"
          >
            {t.navigation.completeTrail}
          </Link>
        )}
      </nav>
    </main>
  );
}
