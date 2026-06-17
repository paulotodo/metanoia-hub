'use client';

import type { LessonStatus } from '@metanoia/types';

// ---------------------------------------------------------------------------
// TrailProgressBar — barra de progresso para trilha ou módulo
// ---------------------------------------------------------------------------

interface TrailProgressBarProps {
  /** Percentual de conclusão (0–100) */
  progressPercent: number;
  /** Rótulo acessível, ex: "Trilha Fundamentos — 75% concluída" */
  label?: string;
  className?: string;
}

export function TrailProgressBar({ progressPercent, label, className }: TrailProgressBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));
  const displayLabel = label ?? `${clampedPercent}% concluído`;

  return (
    <div className={className} role="progressbar" aria-valuenow={clampedPercent} aria-valuemin={0} aria-valuemax={100} aria-label={displayLabel}>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full motion-safe:transition-all duration-300"
            style={{ width: `${clampedPercent}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground tabular-nums min-w-[3.5ch]">
          {clampedPercent}%
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LessonStatusIcon — ícone de status da aula (circle/half-circle/checkmark)
// ---------------------------------------------------------------------------

interface LessonStatusIconProps {
  status: LessonStatus;
  className?: string;
}

/**
 * Ícone de status da aula:
 * - not_started: círculo vazio (○)
 * - in_progress: círculo meio preenchido (◑)
 * - completed: marca de verificação (✓)
 */
export function LessonStatusIcon({ status, className }: LessonStatusIconProps) {
  if (status === 'completed') {
    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold ${className ?? ''}`}
        aria-label="Aula concluída"
        role="img"
      >
        ✓
      </span>
    );
  }

  if (status === 'in_progress') {
    return (
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 border-primary bg-primary/20 text-xs ${className ?? ''}`}
        aria-label="Aula em andamento"
        role="img"
      >
        ◑
      </span>
    );
  }

  // not_started
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full border-2 border-muted-foreground text-xs ${className ?? ''}`}
      aria-label="Aula não iniciada"
      role="img"
    >
      ○
    </span>
  );
}

// ---------------------------------------------------------------------------
// ResumeLessonLink — link "Continuar de onde parei"
// ---------------------------------------------------------------------------

interface ResumeLessonLinkProps {
  lessonId: string | null;
  moduleId: string | null;
  trailId: string;
  className?: string;
}

/**
 * Link pastoral "Continuar de onde parei".
 * Usa lastAccessedAt via useResumeLesson() para determinar a última aula incompleta.
 */
export function ResumeLessonLink({ lessonId, moduleId, trailId, className }: ResumeLessonLinkProps) {
  if (!lessonId || !moduleId) {
    return null;
  }

  const href = `/app/trilhas/${trailId}/modulos/${moduleId}/aulas/${lessonId}`;

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium ${className ?? ''}`}
    >
      Continuar de onde parei
      <span aria-hidden="true">→</span>
    </a>
  );
}
