'use client';

import type { ModuleProgressDetail } from '@metanoia/types';
import { TrailProgressBar, LessonStatusIcon, ResumeLessonLink } from '@/components/content/trail-progress-bar';
import { useTrailProgress, useResumeLesson } from '@/lib/api/hooks/use-progress';

interface TrailProgressViewProps {
  trailId: string;
}

/**
 * TrailProgressView — Client Component que exibe o progresso de uma trilha.
 *
 * - Barra de progresso da trilha e de cada módulo
 * - Ícones de status por aula (○ não iniciada, ◑ em andamento, ✓ concluída)
 * - Link "Continuar de onde parei" via lastAccessedAt
 *
 * Vocabulário pastoral: "trilha" não "curso", "aula" não "vídeo".
 */
export function TrailProgressView({ trailId }: TrailProgressViewProps) {
  const { data: progressData, isLoading, isError } = useTrailProgress(trailId);
  const { data: resumeData } = useResumeLesson(trailId);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" aria-busy="true">
        <div className="h-6 w-48 bg-muted motion-safe:animate-pulse rounded" />
        <div className="h-4 w-full bg-muted motion-safe:animate-pulse rounded" />
        <div className="h-4 w-3/4 bg-muted motion-safe:animate-pulse rounded" />
      </div>
    );
  }

  if (isError || !progressData) {
    return (
      <div className="p-6 text-destructive" role="alert">
        Não foi possível carregar seu progresso. Tente novamente em alguns instantes.
      </div>
    );
  }

  const { data } = progressData;
  const resume = resumeData?.data;

  return (
    <div className="p-6 space-y-8">
      {/* Trail header + overall progress */}
      <section aria-labelledby="trail-progress-heading">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 id="trail-progress-heading" className="text-lg font-semibold">
            Meu Progresso na Trilha
          </h2>
          {resume && (
            <ResumeLessonLink
              lessonId={resume.lessonId}
              moduleId={resume.moduleId}
              trailId={trailId}
            />
          )}
        </div>
        <TrailProgressBar
          progressPercent={data.progressPercent}
          label={`Trilha — ${data.progressPercent}% concluída`}
        />
        <p className="text-sm text-muted-foreground mt-2">
          {data.completedModules} de {data.totalModules}{' '}
          {data.totalModules === 1 ? 'módulo concluído' : 'módulos concluídos'}
        </p>
      </section>

      {/* Modules */}
      <section aria-label="Módulos da trilha">
        <div className="space-y-6">
          {data.modules.map((mod: ModuleProgressDetail) => (
            <div key={mod.moduleId} className="border rounded-lg p-4 space-y-3">
              {/* Module progress */}
              <div className="space-y-1">
                <TrailProgressBar
                  progressPercent={mod.progressPercent}
                  label={`Módulo — ${mod.progressPercent}% concluído`}
                />
                <p className="text-xs text-muted-foreground">
                  {mod.completedLessons}/{mod.totalLessons}{' '}
                  {mod.totalLessons === 1 ? 'aula' : 'aulas'} concluídas
                </p>
              </div>

              {/* Lessons list */}
              <ul className="space-y-2" aria-label="Aulas deste módulo">
                {mod.lessons.map((lesson) => (
                  <li key={lesson.lessonId} className="flex items-center gap-3">
                    <LessonStatusIcon status={lesson.status} />
                    <span className="text-sm flex-1">
                      {lesson.status === 'in_progress' && (
                        <span className="text-primary font-medium">
                          Em andamento —{' '}
                        </span>
                      )}
                      {lesson.progressPercent > 0 && lesson.status !== 'completed' && (
                        <span className="text-muted-foreground text-xs">
                          ({lesson.progressPercent}%)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
