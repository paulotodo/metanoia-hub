/**
 * use-locked-lessons — pure helper (no React hooks) that derives locked state
 * for lessons within a module based on lessonAccessMode and current progress.
 *
 * Ref: spec §FR-005, dec-009 (derive lock on FE, not backend).
 */

import type { ModuleResponse, LessonResponse, LessonStatus } from '@metanoia/types';

export interface LockState {
  locked: boolean;
  reason: string | null;
}

/**
 * deriveLockedLessons — given a module and per-lesson progress,
 * returns a map of lessonId → { locked, reason }.
 *
 * Rules:
 * - lessonAccessMode = 'free': all lessons unlocked
 * - lessonAccessMode = 'sequential':
 *   - lessons[0]: always unlocked
 *   - lessons[i] (i > 0): locked if lessons[i-1].status !== 'completed'
 */
export function deriveLockedLessons(
  module: ModuleResponse,
  lessons: LessonResponse[],
  progressByLessonId: Record<string, LessonStatus>,
): Record<string, LockState> {
  const result: Record<string, LockState> = {};

  if (module.lessonAccessMode === 'free') {
    for (const lesson of lessons) {
      result[lesson.id] = { locked: false, reason: null };
    }
    return result;
  }

  // sequential mode
  const sorted = [...lessons].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sorted.length; i++) {
    const lesson = sorted[i];
    if (i === 0) {
      // First lesson is always unlocked
      result[lesson.id] = { locked: false, reason: null };
      continue;
    }

    const prevLesson = sorted[i - 1];
    const prevStatus = progressByLessonId[prevLesson.id] ?? 'not_started';
    const isLocked = prevStatus !== 'completed';

    result[lesson.id] = {
      locked: isLocked,
      reason: isLocked
        ? 'Complete a aula anterior para prosseguir neste caminho'
        : null,
    };
  }

  return result;
}
