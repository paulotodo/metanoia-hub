import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { VersionService } from './version.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(async (_prisma: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    return fn(mockTx);
  }),
}));

const TRAIL_ID = 'aaaaaaaa-aaaa-7000-8000-000000000001';
const TENANT_ID = 'bbbbbbbb-bbbb-7000-8000-000000000001';
const USER_ID = 'cccccccc-cccc-7000-8000-000000000001';

const baseTrail = {
  id: TRAIL_ID,
  tenantId: TENANT_ID,
  name: 'Test Trail',
  status: 'published' as const,
  deletedAt: null,
};

const v1 = {
  id: 'dddddddd-dddd-7000-8000-000000000001',
  tenantId: TENANT_ID,
  trailId: TRAIL_ID,
  version: 1,
  snapshotData: { version: 1, modules: [] },
  publishedAt: new Date('2026-06-10T00:00:00Z'),
  publishedBy: USER_ID,
  createdAt: new Date('2026-06-10T00:00:00Z'),
};

const v2 = {
  ...v1,
  id: 'eeeeeeee-eeee-7000-8000-000000000001',
  version: 2,
  snapshotData: { version: 2, modules: [] },
  publishedAt: new Date('2026-06-15T00:00:00Z'),
  createdAt: new Date('2026-06-15T00:00:00Z'),
};

const mockTx = {
  trail: { findFirst: vi.fn() },
  trailVersion: { findMany: vi.fn() },
  lesson: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VersionService', () => {
  let service: VersionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VersionService({} as never);
  });

  describe('listVersions', () => {
    it('returns versions ordered newest first', async () => {
      mockTx.trail.findFirst.mockResolvedValue(baseTrail);
      mockTx.trailVersion.findMany.mockResolvedValue([v2, v1]);

      const result = await service.listVersions(TRAIL_ID);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].version).toBe(2);
      expect(result.data[1].version).toBe(1);
      expect(result.meta.total).toBe(2);
    });

    it('throws NotFoundException when trail not found', async () => {
      mockTx.trail.findFirst.mockResolvedValue(null);
      await expect(service.listVersions(TRAIL_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveOrphanedProgress — regression: v1 progress preserved on v2 publish', () => {
    it('does not archive active lessons (progress preserved)', async () => {
      // Active lesson still in trail → NOT orphaned
      const LESSON_ID = 'ffffffff-ffff-7000-8000-000000000001';
      mockTx.lesson.findMany.mockResolvedValue([{ id: LESSON_ID }]);
      // No orphaned progress rows
      mockTx.$queryRaw.mockResolvedValue([]);

      await service.archiveOrphanedProgress(TRAIL_ID);

      // $executeRawUnsafe (the UPDATE) should NOT be called because no orphans
      expect(mockTx.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('soft-archives progress for deleted lessons (never deletes)', async () => {
      const _DELETED_LESSON_ID = 'aaaa0000-0000-7000-8000-000000000001';
      const PROGRESS_ID = 'bbbb0000-0000-7000-8000-000000000001';

      // No active lessons (the lesson was deleted in v2)
      mockTx.lesson.findMany.mockResolvedValue([]);
      // Orphaned progress row for the deleted lesson
      mockTx.$queryRaw.mockResolvedValue([{ id: PROGRESS_ID }]);

      await service.archiveOrphanedProgress(TRAIL_ID);

      // Must UPDATE (soft-archive), never DELETE
      expect(mockTx.$executeRawUnsafe).toHaveBeenCalledOnce();
      const call = mockTx.$executeRawUnsafe.mock.calls[0][0] as string;
      expect(call).toContain('UPDATE lesson_progress');
      expect(call).toContain("status = 'completed'");
      expect(call).not.toContain('DELETE');
    });

    it('is a no-op when no orphans exist (all lessons still active, query returns empty)', async () => {
      const LESSON_ID_V1 = 'cccc0000-0000-7000-8000-000000000001';
      const LESSON_ID_V2 = 'dddd0000-0000-7000-8000-000000000001';

      // Both lessons still active in v2
      mockTx.lesson.findMany.mockResolvedValue([
        { id: LESSON_ID_V1 },
        { id: LESSON_ID_V2 },
      ]);
      // queryRaw returns no rows — the query filters by deleted_at IS NOT NULL,
      // so active lessons produce no progress rows to archive.
      mockTx.$queryRaw.mockResolvedValue([]);

      await service.archiveOrphanedProgress(TRAIL_ID);

      // No orphaned progress → no UPDATE
      expect(mockTx.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });
});
