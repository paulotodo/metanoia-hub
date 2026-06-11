/**
 * use-locked-lessons.spec.ts — T1
 * Pure unit tests for deriveLockedLessons helper.
 * Ref: tasks.md §2.2.4, spec §FR-005, dec-009.
 */

import { describe, it, expect } from 'vitest';
import { deriveLockedLessons } from './use-locked-lessons';
import type { ModuleResponse, LessonResponse, LessonStatus } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '019756a1-0000-7000-8000-000000000099';
const MODULE_ID = '019756a1-0000-7000-8000-000000000010';
const LESSON_A = '019756a1-0000-7000-8000-000000000020';
const LESSON_B = '019756a1-0000-7000-8000-000000000021';
const LESSON_C = '019756a1-0000-7000-8000-000000000022';

const makeModule = (lessonAccessMode: 'free' | 'sequential'): ModuleResponse => ({
  id: MODULE_ID,
  tenantId: TENANT_ID,
  trailId: '019756a1-0000-7000-8000-000000000001',
  name: 'Módulo Teste',
  order: 0,
  lessonAccessMode,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
});

const lessons: LessonResponse[] = [
  {
    id: LESSON_A,
    tenantId: TENANT_ID,
    moduleId: MODULE_ID,
    name: 'Aula 1',
    contentType: 'video',
    contentUrl: null,
    contentBody: null,
    tags: [],
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: null,
    uploadedAt: null,
    order: 0,
    estimatedDurationMinutes: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: LESSON_B,
    tenantId: TENANT_ID,
    moduleId: MODULE_ID,
    name: 'Aula 2',
    contentType: 'rich_text',
    contentUrl: null,
    contentBody: null,
    tags: [],
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: null,
    uploadedAt: null,
    order: 1,
    estimatedDurationMinutes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: LESSON_C,
    tenantId: TENANT_ID,
    moduleId: MODULE_ID,
    name: 'Aula 3',
    contentType: 'pdf_doc',
    contentUrl: null,
    contentBody: null,
    tags: [],
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: null,
    uploadedAt: null,
    order: 2,
    estimatedDurationMinutes: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  },
];

// ---------------------------------------------------------------------------
// T1: deriveLockedLessons
// ---------------------------------------------------------------------------

describe('deriveLockedLessons', () => {
  describe('free mode', () => {
    it('T1-free: all lessons unlocked regardless of progress', () => {
      const mod = makeModule('free');
      const progress: Record<string, LessonStatus> = {};
      const result = deriveLockedLessons(mod, lessons, progress);

      expect(result[LESSON_A]).toEqual({ locked: false, reason: null });
      expect(result[LESSON_B]).toEqual({ locked: false, reason: null });
      expect(result[LESSON_C]).toEqual({ locked: false, reason: null });
    });

    it('T1-free-with-progress: still all unlocked even if some completed', () => {
      const mod = makeModule('free');
      const progress: Record<string, LessonStatus> = {
        [LESSON_A]: 'completed',
        [LESSON_B]: 'in_progress',
      };
      const result = deriveLockedLessons(mod, lessons, progress);

      for (const lesson of lessons) {
        expect(result[lesson.id].locked).toBe(false);
        expect(result[lesson.id].reason).toBeNull();
      }
    });

    it('T1-free-empty: empty lessons returns empty map', () => {
      const mod = makeModule('free');
      const result = deriveLockedLessons(mod, [], {});
      expect(result).toEqual({});
    });
  });

  describe('sequential mode', () => {
    it('T1-seq-first: lesson[0] always unlocked', () => {
      const mod = makeModule('sequential');
      const result = deriveLockedLessons(mod, lessons, {});
      expect(result[LESSON_A]).toEqual({ locked: false, reason: null });
    });

    it('T1-seq-locked-when-prev-not-completed: lesson[i] locked when lesson[i-1] not completed', () => {
      const mod = makeModule('sequential');
      // No progress at all
      const result = deriveLockedLessons(mod, lessons, {});
      expect(result[LESSON_B].locked).toBe(true);
      expect(result[LESSON_B].reason).toBeTypeOf('string');
      expect(result[LESSON_C].locked).toBe(true);
    });

    it('T1-seq-locked-when-prev-in-progress: lesson[i] locked when lesson[i-1] in_progress', () => {
      const mod = makeModule('sequential');
      const progress: Record<string, LessonStatus> = {
        [LESSON_A]: 'in_progress',
      };
      const result = deriveLockedLessons(mod, lessons, progress);
      expect(result[LESSON_B].locked).toBe(true);
      expect(result[LESSON_C].locked).toBe(true);
    });

    it('T1-seq-unlocked-when-prev-completed: lesson[i] unlocked when lesson[i-1] completed', () => {
      const mod = makeModule('sequential');
      const progress: Record<string, LessonStatus> = {
        [LESSON_A]: 'completed',
      };
      const result = deriveLockedLessons(mod, lessons, progress);
      expect(result[LESSON_A]).toEqual({ locked: false, reason: null });
      expect(result[LESSON_B]).toEqual({ locked: false, reason: null });
      // LESSON_C still locked — LESSON_B not completed
      expect(result[LESSON_C].locked).toBe(true);
    });

    it('T1-seq-chain: all unlocked when all completed', () => {
      const mod = makeModule('sequential');
      const progress: Record<string, LessonStatus> = {
        [LESSON_A]: 'completed',
        [LESSON_B]: 'completed',
        [LESSON_C]: 'completed',
      };
      const result = deriveLockedLessons(mod, lessons, progress);
      for (const lesson of lessons) {
        expect(result[lesson.id]).toEqual({ locked: false, reason: null });
      }
    });

    it('T1-seq-reason: locked lesson has non-empty pastoral reason string', () => {
      const mod = makeModule('sequential');
      const result = deriveLockedLessons(mod, lessons, {});
      expect(result[LESSON_B].reason).toBeTruthy();
      expect((result[LESSON_B].reason ?? '').length).toBeGreaterThan(10);
    });

    it('T1-seq-order: uses order field, not array index', () => {
      // Deliberately out-of-order array: C before A before B
      const outOfOrder: LessonResponse[] = [
        { ...lessons[2] }, // order=2 (LESSON_C)
        { ...lessons[0] }, // order=0 (LESSON_A)
        { ...lessons[1] }, // order=1 (LESSON_B)
      ];
      const mod = makeModule('sequential');
      const result = deriveLockedLessons(mod, outOfOrder, {});
      // LESSON_A (order=0) → always unlocked
      expect(result[LESSON_A]).toEqual({ locked: false, reason: null });
      // LESSON_B (order=1) → locked (prev=LESSON_A not completed)
      expect(result[LESSON_B].locked).toBe(true);
      // LESSON_C (order=2) → locked (prev=LESSON_B not completed)
      expect(result[LESSON_C].locked).toBe(true);
    });
  });
});
