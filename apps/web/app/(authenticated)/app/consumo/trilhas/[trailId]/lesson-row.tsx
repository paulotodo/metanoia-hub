'use client';

import type { LessonResponse, LessonStatus } from '@metanoia/types';
import { LessonStatusIcon } from '@/components/content/trail-progress-bar';
import { LockIndicator } from '@/components/content/lock-indicator';
import messages from '../../../../../../messages/pt-BR.json';

const t = messages.trailPlaylist;

// ---------------------------------------------------------------------------
// LessonRow — single lesson entry in a module accordion
// ---------------------------------------------------------------------------

interface LessonRowProps {
  lesson: LessonResponse;
  /** Status from progress API, defaults to 'not_started' */
  lessonStatus?: LessonStatus;
  /** Whether this lesson is the active (currently-playing) one */
  isActive: boolean;
  isLocked: boolean;
  lockReason: string | null;
  onSelect: (id: string) => void;
}

export function LessonRow({
  lesson,
  lessonStatus = 'not_started',
  isActive,
  isLocked,
  lockReason,
  onSelect,
}: LessonRowProps) {
  const handleClick = () => {
    if (!isLocked) {
      onSelect(lesson.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isLocked) {
        onSelect(lesson.id);
      }
    }
  };

  const lockReasonText = lockReason ?? t.locked.reason;

  // Build aria-label for locked lessons (spec US2-AC3)
  const ariaLabel = isLocked
    ? `${lesson.name} — ${lockReasonText}`
    : lesson.name;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={isLocked ? 'true' : undefined}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        'flex items-center gap-3 p-5 rounded-xl cursor-pointer min-h-11',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-brand-teal/10 border-l-2 border-brand-teal'
          : 'hover:bg-muted/50',
        isLocked ? 'opacity-60 cursor-default' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="lesson-row"
      data-lesson-id={lesson.id}
    >
      {/* Status icon */}
      <LessonStatusIcon status={lessonStatus} className="shrink-0" />

      {/* Lesson info */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{lesson.name}</span>
        {lesson.estimatedDurationMinutes !== null && (
          <span className="text-xs text-muted-foreground">
            {`${lesson.estimatedDurationMinutes} min`}
          </span>
        )}
      </div>

      {/* Lock indicator */}
      {isLocked && (
        <LockIndicator
          reason={lockReasonText}
          size={16}
          className="shrink-0"
        />
      )}
    </div>
  );
}
