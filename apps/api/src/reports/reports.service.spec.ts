import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Role } from '../auth/enums/role.enum';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { REPORTS_CSV_BOM } from '@metanoia/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQueue = { add: vi.fn() };
const mockBullMqService = { createQueue: vi.fn(() => mockQueue), createWorker: vi.fn() };
const mockRedis = { get: vi.fn(), set: vi.fn() };
const mockStorage = { getSignedUrl: vi.fn(), upload: vi.fn() };

vi.mock('../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({ tenantId: 'tenant-001', userId: 'user-admin-01' })),
}));

const mockTx = {
  trail: { findFirst: vi.fn(), findMany: vi.fn() },
  trailProgress: { findMany: vi.fn(), count: vi.fn() },
  moduleProgress: { findMany: vi.fn() },
  module: { findMany: vi.fn() },
  lesson: { count: vi.fn() },
  groupMember: { findMany: vi.fn() },
  groupTrail: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
};

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn((_prisma: unknown, fn: (tx: typeof mockTx) => Promise<unknown>, _opts?: unknown) => fn(mockTx)),
}));

const mockPrisma = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const adminUser: AuthenticatedUser = {
  userId: 'user-admin-01',
  tenantId: 'tenant-001',
  roles: [Role.ADMIN_TENANT],
  email: 'admin@igreja.com',
};

const liderUser: AuthenticatedUser = {
  userId: 'user-lider-01',
  tenantId: 'tenant-001',
  roles: [Role.LIDER],
  email: 'lider@igreja.com',
};

function makeProgressRecord(overrides: Partial<{
  userId: string;
  progressPercent: number;
  completedModules: number;
  completedAt: Date | null;
  updatedAt: Date;
}> = {}) {
  return {
    userId: 'user-p-01',
    progressPercent: 50,
    completedModules: 2,
    completedAt: null,
    updatedAt: new Date('2026-06-01T10:00:00Z'),
    ...overrides,
  };
}

/** Default trail-structure mocks shared by buildParticipants. */
function mockTrailStructure(opts: { moduleIds?: string[]; totalLessons?: number } = {}) {
  const moduleIds = opts.moduleIds ?? ['mod-01', 'mod-02', 'mod-03', 'mod-04'];
  mockTx.module.findMany.mockResolvedValue(moduleIds.map((id) => ({ id })));
  mockTx.lesson.count.mockResolvedValue(opts.totalLessons ?? 12);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReportsService(
      mockBullMqService as unknown as ConstructorParameters<typeof ReportsService>[0],
      mockPrisma as unknown as ConstructorParameters<typeof ReportsService>[1],
      mockRedis as unknown as ConstructorParameters<typeof ReportsService>[2],
      mockStorage as unknown as ConstructorParameters<typeof ReportsService>[3],
    );
    service.onModuleInit();
  });

  // ─── getTrailReport ─────────────────────────────────────────────────────────

  describe('getTrailReport', () => {
    it('throws NotFoundException for non-existent trail', async () => {
      mockTx.trail.findFirst.mockResolvedValue(null);

      await expect(
        service.getTrailReport('trail-nonexistent', { page: 1, perPage: 20 }, adminUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('admin sees all members of groups with the trail (incl. not-started)', async () => {
      mockTx.trail.findFirst.mockResolvedValue({ id: 'trail-001', name: 'Fundamentos' });
      // admin universe: groupTrail → groups, groupMember → members
      mockTx.groupTrail.findMany.mockResolvedValue([{ groupId: 'group-001' }]);
      mockTx.groupMember.findMany.mockResolvedValue([
        { userId: 'user-started' },
        { userId: 'user-never' },
      ]);
      mockTrailStructure();
      // only one of the two members has progress
      mockTx.trailProgress.findMany.mockResolvedValue([
        makeProgressRecord({ userId: 'user-started' }),
      ]);
      mockTx.user.findMany.mockResolvedValue([
        { id: 'user-started', name: 'Maria Silva', email: 'maria@igreja.com' },
        { id: 'user-never', name: 'João Sem Progresso', email: 'joao@igreja.com' },
      ]);
      mockTx.moduleProgress.findMany.mockResolvedValue([
        { userId: 'user-started', completedLessons: 6 },
      ]);

      const result = await service.getTrailReport('trail-001', { page: 1, perPage: 20 }, adminUser);

      expect(result.data).toHaveLength(2);
      const never = result.data.find((p) => p.userId === 'user-never');
      expect(never?.status).toBe('not_started');
      expect(never?.progressPercent).toBe(0);
      expect(never?.completedModules).toBe(0);
      expect(never?.totalModules).toBe(4); // derived from trail modules, not from progress
      expect(never?.lastActivityAt).toBeNull();
      // aggregates reflect the full universe
      expect(result.meta.total).toBe(2);
      expect(result.meta.notStartedCount).toBe(1);
      expect(result.meta.inProgressCount).toBe(1);
      expect(result.meta.completedCount).toBe(0);
      expect(result.meta.avgProgressPercent).toBe(25); // (50 + 0) / 2
    });

    it('lider sees only their group members with correct trail-scoped lessons', async () => {
      mockTx.trail.findFirst.mockResolvedValue({ id: 'trail-001', name: 'Fundamentos' });
      // lider universe: leader memberships → groupTrail → members
      mockTx.groupMember.findMany
        .mockResolvedValueOnce([{ groupId: 'group-001' }]) // leader memberships
        .mockResolvedValueOnce([{ userId: 'user-p-01' }]); // group members
      mockTx.groupTrail.findMany.mockResolvedValue([{ groupId: 'group-001' }]);
      mockTrailStructure({ totalLessons: 8 });
      mockTx.trailProgress.findMany.mockResolvedValue([makeProgressRecord({ userId: 'user-p-01' })]);
      mockTx.user.findMany.mockResolvedValue([
        { id: 'user-p-01', name: 'Maria Silva', email: 'maria@igreja.com' },
      ]);
      mockTx.moduleProgress.findMany.mockResolvedValue([
        { userId: 'user-p-01', completedLessons: 4 },
      ]);

      const result = await service.getTrailReport('trail-001', { page: 1, perPage: 20 }, liderUser);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].completedLessons).toBe(4);
      expect(result.data[0].totalLessons).toBe(8);
    });

    it('lider with no groups throws ForbiddenException', async () => {
      mockTx.trail.findFirst.mockResolvedValue({ id: 'trail-001', name: 'Fundamentos' });
      mockTx.groupMember.findMany.mockResolvedValueOnce([]);

      await expect(
        service.getTrailReport('trail-001', { page: 1, perPage: 20 }, liderUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('derives correct status from progressPercent and completedAt', async () => {
      mockTx.trail.findFirst.mockResolvedValue({ id: 'trail-001', name: 'Fundamentos' });
      mockTx.groupTrail.findMany.mockResolvedValue([{ groupId: 'group-001' }]);
      mockTx.groupMember.findMany.mockResolvedValue([
        { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' },
      ]);
      mockTrailStructure();
      mockTx.trailProgress.findMany.mockResolvedValue([
        makeProgressRecord({ userId: 'u1', progressPercent: 0, completedAt: null }),
        makeProgressRecord({ userId: 'u2', progressPercent: 50, completedAt: null }),
        makeProgressRecord({ userId: 'u3', progressPercent: 100, completedAt: new Date() }),
      ]);
      mockTx.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'A', email: 'a@t.com' },
        { id: 'u2', name: 'B', email: 'b@t.com' },
        { id: 'u3', name: 'C', email: 'c@t.com' },
      ]);
      mockTx.moduleProgress.findMany.mockResolvedValue([]);

      const result = await service.getTrailReport('trail-001', { page: 1, perPage: 20 }, adminUser);
      const byId = Object.fromEntries(result.data.map((p) => [p.userId, p.status]));

      expect(byId.u1).toBe('not_started');
      expect(byId.u2).toBe('in_progress');
      expect(byId.u3).toBe('completed');
    });

    it('status filter keeps total/pages consistent with the filtered set', async () => {
      mockTx.trail.findFirst.mockResolvedValue({ id: 'trail-001', name: 'Fundamentos' });
      mockTx.groupTrail.findMany.mockResolvedValue([{ groupId: 'group-001' }]);
      mockTx.groupMember.findMany.mockResolvedValue([
        { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' },
      ]);
      mockTrailStructure();
      mockTx.trailProgress.findMany.mockResolvedValue([
        makeProgressRecord({ userId: 'u1', progressPercent: 0, completedAt: null }),
        makeProgressRecord({ userId: 'u2', progressPercent: 50, completedAt: null }),
        makeProgressRecord({ userId: 'u3', progressPercent: 100, completedAt: new Date() }),
      ]);
      mockTx.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'A', email: 'a@t.com' },
        { id: 'u2', name: 'B', email: 'b@t.com' },
        { id: 'u3', name: 'C', email: 'c@t.com' },
      ]);
      mockTx.moduleProgress.findMany.mockResolvedValue([]);

      const result = await service.getTrailReport(
        'trail-001',
        { page: 1, perPage: 20, status: 'completed' },
        adminUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe('u3');
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      // aggregates still describe the full universe, not the filtered view
      expect(result.meta.notStartedCount).toBe(1);
    });

    it('returns empty data (not error) when admin trail has no assigned groups', async () => {
      mockTx.trail.findFirst.mockResolvedValue({ id: 'trail-001', name: 'Fundamentos' });
      mockTx.groupTrail.findMany.mockResolvedValue([]);

      const result = await service.getTrailReport('trail-001', { page: 1, perPage: 20 }, adminUser);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.avgProgressPercent).toBe(0);
    });
  });

  // ─── exportTrailCsv ─────────────────────────────────────────────────────────

  describe('exportTrailCsv', () => {
    beforeEach(() => {
      mockTx.trail.findFirst.mockResolvedValue({ id: 'trail-001', name: 'Fundamentos da Fé' });
    });

    it('returns inline CSV for small trail (< 1000 participants)', async () => {
      mockTx.groupTrail.findMany.mockResolvedValue([{ groupId: 'group-001' }]);
      mockTx.groupMember.findMany.mockResolvedValue([{ userId: 'user-p-01' }]);
      mockTrailStructure();
      mockTx.trailProgress.findMany.mockResolvedValue([makeProgressRecord()]);
      mockTx.user.findMany.mockResolvedValue([
        { id: 'user-p-01', name: 'Maria Silva', email: 'maria@igreja.com' },
      ]);
      mockTx.moduleProgress.findMany.mockResolvedValue([]);

      const result = await service.exportTrailCsv('trail-001', adminUser);

      expect(result.inline).toBe(true);
      if (result.inline) {
        expect(result.csv).toContain(REPORTS_CSV_BOM);
        expect(result.csv).toContain('"Participante"');
        expect(result.csv).toContain('Maria Silva');
        expect(result.filename).toMatch(/trilha-Fundamentos_da_F_-\d{4}-\d{2}-\d{2}\.csv/);
      }
    });

    it('CSV starts with UTF-8 BOM (0xFEFF)', async () => {
      mockTx.groupTrail.findMany.mockResolvedValue([{ groupId: 'group-001' }]);
      mockTx.groupMember.findMany.mockResolvedValue([{ userId: 'user-p-01' }]);
      mockTrailStructure();
      mockTx.trailProgress.findMany.mockResolvedValue([makeProgressRecord()]);
      mockTx.user.findMany.mockResolvedValue([
        { id: 'user-p-01', name: 'João', email: 'j@t.com' },
      ]);
      mockTx.moduleProgress.findMany.mockResolvedValue([]);

      const result = await service.exportTrailCsv('trail-001', adminUser);
      expect(result.inline).toBe(true);
      if (result.inline) {
        expect(result.csv.charCodeAt(0)).toBe(0xfeff);
      }
    });

    it('enqueues async job and returns 202/jobId for large trail (> 1000 participants)', async () => {
      const manyMembers = Array.from({ length: 1001 }, (_, i) => ({ userId: `u-${i}` }));
      mockTx.groupTrail.findMany.mockResolvedValue([{ groupId: 'group-001' }]);
      mockTx.groupMember.findMany.mockResolvedValue(manyMembers);

      const result = await service.exportTrailCsv('trail-001', adminUser);

      expect(result.inline).toBe(false);
      if (!result.inline) {
        expect(typeof result.jobId).toBe('string');
      }
      expect(mockQueue.add).toHaveBeenCalledWith(
        'export-trail-csv',
        expect.objectContaining({ trailId: 'trail-001', userIds: expect.any(Array) }),
        expect.any(Object),
      );
      expect(mockRedis.set).toHaveBeenCalled();
      // heavy build skipped for async path
      expect(mockTx.module.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── getJobStatus ────────────────────────────────────────────────────────────

  describe('getJobStatus', () => {
    it('throws NotFoundException for unknown job', async () => {
      mockRedis.get.mockResolvedValue(null);
      await expect(service.getJobStatus('nonexistent-job')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns parsed job status', async () => {
      const stored = {
        jobId: 'job-123',
        status: 'completed',
        signedUrl: 'https://minio/export.csv',
        expiresAt: '2026-06-10T23:00:00Z',
        failureReason: null,
        // S1: requesterUserId matches userId from mocked RequestContext ('user-admin-01')
        requesterUserId: 'user-admin-01',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));

      const result = await service.getJobStatus('job-123');
      expect(result.status).toBe('completed');
      expect(result.signedUrl).toBe('https://minio/export.csv');
    });
  });

  // ─── processExportJob ─────────────────────────────────────────────────────────

  describe('processExportJob', () => {
    it('builds CSV, uploads to storage and stores completed status with signed URL', async () => {
      mockTrailStructure();
      mockTx.trailProgress.findMany.mockResolvedValue([makeProgressRecord({ userId: 'u1' })]);
      mockTx.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Maria', email: 'm@t.com' }]);
      mockTx.moduleProgress.findMany.mockResolvedValue([{ userId: 'u1', completedLessons: 6 }]);
      mockStorage.upload.mockResolvedValue('exports/key.csv');
      mockStorage.getSignedUrl.mockResolvedValue('https://minio/signed.csv');

      await service.processExportJob({
        kind: 'trail',
        jobId: 'job-xyz',
        tenantId: 'tenant-001',
        trailId: 'trail-001',
        trailName: 'Fundamentos',
        requestedBy: 'user-admin-01',
        userIds: ['u1'],
      });

      expect(mockStorage.upload).toHaveBeenCalled();
      expect(mockStorage.getSignedUrl).toHaveBeenCalledWith(expect.any(String), 3600);
      const lastSet = mockRedis.set.mock.calls.at(-1);
      expect(lastSet?.[1]).toContain('"status":"completed"');
      expect(lastSet?.[1]).toContain('https://minio/signed.csv');
    });

    it('stores failed status when storage throws', async () => {
      mockTrailStructure();
      mockTx.trailProgress.findMany.mockResolvedValue([]);
      mockTx.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Maria', email: 'm@t.com' }]);
      mockTx.moduleProgress.findMany.mockResolvedValue([]);
      mockStorage.upload.mockRejectedValue(new Error('minio down'));

      await expect(
        service.processExportJob({
          kind: 'trail',
          jobId: 'job-fail',
          tenantId: 'tenant-001',
          trailId: 'trail-001',
          trailName: 'Fundamentos',
          requestedBy: 'user-admin-01',
          userIds: ['u1'],
        }),
      ).rejects.toThrow('minio down');

      const lastSet = mockRedis.set.mock.calls.at(-1);
      expect(lastSet?.[1]).toContain('"status":"failed"');
    });
  });
});
