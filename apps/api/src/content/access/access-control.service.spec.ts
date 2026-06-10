import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessControlService } from './access-control.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTx = {
  trail: { findFirst: vi.fn() },
  module: { findFirst: vi.fn() },
  lesson: { findFirst: vi.fn() },
  moduleProgress: { findMany: vi.fn(), findFirst: vi.fn() },
  lessonProgress: { findFirst: vi.fn() },
  modulePrerequisite: { findMany: vi.fn() },
};

// withTenantTx executes fn(tx) immediately with mocked tx
vi.mock('../../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn((_prisma: unknown, fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
}));

vi.mock('../../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: 'tenant-aaa',
    userId: 'user-111',
    requestId: 'req-1',
    correlationId: 'corr-1',
  })),
}));

const mockPrisma = {} as never;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrail(accessMode: 'sequential' | 'free') {
  return { accessMode };
}

function makeModule(id: string, order: number, lessonAccessMode: 'sequential' | 'free' = 'free') {
  return { id, order, lessonAccessMode };
}

function makeLesson(id: string, order: number) {
  return { id, order };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccessControlService', () => {
  let service: AccessControlService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccessControlService(mockPrisma);
  });

  // ---- Trail sequential ----

  describe('assertModuleAccess — trail sequential', () => {
    it('allows access when module is first (no previous module)', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('sequential'));
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-2', 1)) // targetModule
        .mockResolvedValueOnce(null); // no previousModule
      mockTx.modulePrerequisite.findMany.mockResolvedValue([]);

      await expect(service.assertModuleAccess('trail-1', 'mod-2')).resolves.toBeUndefined();
    });

    it('allows access when previous module is completed', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('sequential'));
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-2', 1)) // targetModule
        .mockResolvedValueOnce(makeModule('mod-1', 0)); // previousModule
      mockTx.moduleProgress.findFirst.mockResolvedValue({ completedAt: new Date() });
      mockTx.modulePrerequisite.findMany.mockResolvedValue([]);

      await expect(service.assertModuleAccess('trail-1', 'mod-2')).resolves.toBeUndefined();
    });

    it('blocks access when previous module is not completed', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('sequential'));
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-2', 1))
        .mockResolvedValueOnce(makeModule('mod-1', 0));
      mockTx.moduleProgress.findFirst.mockResolvedValue({ completedAt: null });
      mockTx.modulePrerequisite.findMany.mockResolvedValue([]);

      await expect(service.assertModuleAccess('trail-1', 'mod-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks access when no ModuleProgress exists for previous module', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('sequential'));
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-2', 1))
        .mockResolvedValueOnce(makeModule('mod-1', 0));
      mockTx.moduleProgress.findFirst.mockResolvedValue(null);
      mockTx.modulePrerequisite.findMany.mockResolvedValue([]);

      await expect(service.assertModuleAccess('trail-1', 'mod-2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ---- Trail free ----

  describe('assertModuleAccess — trail free', () => {
    it('allows access regardless of previous module completion status', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('free'));
      mockTx.module.findFirst.mockResolvedValueOnce(makeModule('mod-3', 2));
      mockTx.modulePrerequisite.findMany.mockResolvedValue([]);

      await expect(service.assertModuleAccess('trail-1', 'mod-3')).resolves.toBeUndefined();
    });
  });

  // ---- Prerequisites ----

  describe('assertModuleAccess — prerequisites (Module C requires A and B)', () => {
    it('blocks when prerequisite A is not completed', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('free'));
      mockTx.module.findFirst.mockResolvedValueOnce(makeModule('mod-C', 2));
      mockTx.modulePrerequisite.findMany.mockResolvedValue([
        { prerequisiteModuleId: 'mod-A' },
        { prerequisiteModuleId: 'mod-B' },
      ]);
      mockTx.moduleProgress.findMany.mockResolvedValue([
        { moduleId: 'mod-B' }, // only B completed
      ]);

      await expect(service.assertModuleAccess('trail-1', 'mod-C')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows when all prerequisites A and B are completed', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('free'));
      mockTx.module.findFirst.mockResolvedValueOnce(makeModule('mod-C', 2));
      mockTx.modulePrerequisite.findMany.mockResolvedValue([
        { prerequisiteModuleId: 'mod-A' },
        { prerequisiteModuleId: 'mod-B' },
      ]);
      mockTx.moduleProgress.findMany.mockResolvedValue([
        { moduleId: 'mod-A' },
        { moduleId: 'mod-B' },
      ]);

      await expect(service.assertModuleAccess('trail-1', 'mod-C')).resolves.toBeUndefined();
    });
  });

  // ---- Lesson sequential ----

  describe('assertLessonAccess — module lessonAccessMode sequential', () => {
    beforeEach(() => {
      // Common: trail=free, module found for assertModuleAccess
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('free'));
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-1', 0)); // targetModule (assertModuleAccess)
      mockTx.modulePrerequisite.findMany.mockResolvedValue([]);
    });

    it('blocks when previous lesson not completed', async () => {
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-1', 0, 'sequential')); // second call in assertLessonAccess
      mockTx.lesson.findFirst
        .mockResolvedValueOnce(makeLesson('lesson-2', 1)) // targetLesson
        .mockResolvedValueOnce(makeLesson('lesson-1', 0)); // previousLesson
      mockTx.lessonProgress.findFirst.mockResolvedValue({ status: 'in_progress' });

      await expect(
        service.assertLessonAccess('trail-1', 'mod-1', 'lesson-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows when previous lesson is completed', async () => {
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-1', 0, 'sequential'));
      mockTx.lesson.findFirst
        .mockResolvedValueOnce(makeLesson('lesson-2', 1))
        .mockResolvedValueOnce(makeLesson('lesson-1', 0));
      mockTx.lessonProgress.findFirst.mockResolvedValue({ status: 'completed' });

      await expect(
        service.assertLessonAccess('trail-1', 'mod-1', 'lesson-2'),
      ).resolves.toBeUndefined();
    });

    it('allows first lesson (no previous lesson)', async () => {
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-1', 0, 'sequential'));
      mockTx.lesson.findFirst
        .mockResolvedValueOnce(makeLesson('lesson-1', 0)) // targetLesson
        .mockResolvedValueOnce(null); // no previousLesson

      await expect(
        service.assertLessonAccess('trail-1', 'mod-1', 'lesson-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertLessonAccess — module lessonAccessMode free', () => {
    it('allows any lesson regardless of order', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('free'));
      mockTx.module.findFirst
        .mockResolvedValueOnce(makeModule('mod-1', 0)) // assertModuleAccess
        .mockResolvedValueOnce(makeModule('mod-1', 0, 'free')); // lessonAccessMode check
      mockTx.modulePrerequisite.findMany.mockResolvedValue([]);
      mockTx.lesson.findFirst.mockResolvedValueOnce(makeLesson('lesson-5', 4));

      await expect(
        service.assertLessonAccess('trail-1', 'mod-1', 'lesson-5'),
      ).resolves.toBeUndefined();
    });
  });

  // ---- Not found ----

  describe('not found cases', () => {
    it('throws NotFoundException when trail not found', async () => {
      mockTx.trail.findFirst.mockResolvedValue(null);

      await expect(service.assertModuleAccess('bad-trail', 'mod-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when module not found', async () => {
      mockTx.trail.findFirst.mockResolvedValue(makeTrail('free'));
      mockTx.module.findFirst.mockResolvedValueOnce(null);

      await expect(service.assertModuleAccess('trail-1', 'bad-mod')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
