import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyTrailsService } from './my-trails.service';
import * as requestContextModule from '../../common/context/request-context';
import * as withTenantTxModule from '../../prisma/with-tenant-tx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrail(id: string, name = `Trail ${id}`) {
  return { id, name, description: null };
}

function makeProgress(trailId: string, progressPercent: number, completedAt: Date | null = null) {
  return {
    trailId,
    progressPercent,
    completedAt,
    updatedAt: new Date('2026-06-01T10:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  groupMember: { findMany: vi.fn() },
  groupTrail: { findMany: vi.fn() },
  trail: { count: vi.fn(), findMany: vi.fn() },
  module: { groupBy: vi.fn(), findMany: vi.fn() },
  lesson: { groupBy: vi.fn() },
  trailProgress: { findMany: vi.fn() },
} as unknown as import('../../prisma/prisma.service').PrismaService;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyTrailsService', () => {
  let service: MyTrailsService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock RequestContext
    vi.spyOn(requestContextModule, 'getRequestContext').mockReturnValue({
      tenantId: 'tenant-001',
      userId: 'user-001',
      requestId: 'req-001',
      correlationId: 'corr-001',
    });

    // Mock withTenantTx to run callback directly with mockPrisma
    vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
      async (_prisma, fn) => fn(mockPrisma as unknown as Parameters<typeof fn>[0]),
    );

    service = new MyTrailsService(mockPrisma);
  });

  it('returns empty data when user has no group memberships', async () => {
    vi.mocked(mockPrisma.groupMember.findMany).mockResolvedValue([]);

    const result = await service.listMyTrails();
    expect(result).toEqual({ data: [], meta: { nextCursor: null, total: 0 } });
  });

  it('returns empty data when groups have no trails', async () => {
    vi.mocked(mockPrisma.groupMember.findMany).mockResolvedValue([{ groupId: 'group-001' }]);
    vi.mocked(mockPrisma.groupTrail.findMany).mockResolvedValue([]);

    const result = await service.listMyTrails();
    expect(result).toEqual({ data: [], meta: { nextCursor: null, total: 0 } });
  });

  it('returns only published trails with correct aggregation', async () => {
    vi.mocked(mockPrisma.groupMember.findMany).mockResolvedValue([{ groupId: 'group-001' }]);
    vi.mocked(mockPrisma.groupTrail.findMany).mockResolvedValue([{ trailId: 'trail-001' }]);
    vi.mocked(mockPrisma.trail.count).mockResolvedValue(1);
    vi.mocked(mockPrisma.trail.findMany).mockResolvedValue([makeTrail('trail-001')]);
    vi.mocked(mockPrisma.module.groupBy).mockResolvedValue([{ trailId: 'trail-001', _count: { id: 2 } }]);
    vi.mocked(mockPrisma.module.findMany).mockResolvedValue([
      { id: 'mod-001', trailId: 'trail-001' },
    ]);
    vi.mocked(mockPrisma.lesson.groupBy).mockResolvedValue([
      { moduleId: 'mod-001', _count: { id: 5 } },
    ]);
    vi.mocked(mockPrisma.trailProgress.findMany).mockResolvedValue([
      makeProgress('trail-001', 50),
    ]);

    const result = await service.listMyTrails();
    expect(result.data).toHaveLength(1);
    const item = result.data[0]!;
    expect(item.id).toBe('trail-001');
    expect(item.moduleCount).toBe(2);
    expect(item.lessonCount).toBe(5);
    expect(item.progressPercent).toBe(50);
    expect(item.status).toBe('in_progress');
    expect(item.lastActivity).toBe('2026-06-01T10:00:00.000Z');
    expect(result.meta.total).toBe(1);
    expect(result.meta.nextCursor).toBeNull();
  });

  it('computes status not_started when no progress record', async () => {
    vi.mocked(mockPrisma.groupMember.findMany).mockResolvedValue([{ groupId: 'group-001' }]);
    vi.mocked(mockPrisma.groupTrail.findMany).mockResolvedValue([{ trailId: 'trail-002' }]);
    vi.mocked(mockPrisma.trail.count).mockResolvedValue(1);
    vi.mocked(mockPrisma.trail.findMany).mockResolvedValue([makeTrail('trail-002')]);
    vi.mocked(mockPrisma.module.groupBy).mockResolvedValue([]);
    vi.mocked(mockPrisma.module.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.lesson.groupBy).mockResolvedValue([]);
    vi.mocked(mockPrisma.trailProgress.findMany).mockResolvedValue([]);

    const result = await service.listMyTrails();
    expect(result.data[0]?.status).toBe('not_started');
    expect(result.data[0]?.lastActivity).toBeNull();
  });

  it('computes status completed when completedAt is set', async () => {
    vi.mocked(mockPrisma.groupMember.findMany).mockResolvedValue([{ groupId: 'group-001' }]);
    vi.mocked(mockPrisma.groupTrail.findMany).mockResolvedValue([{ trailId: 'trail-003' }]);
    vi.mocked(mockPrisma.trail.count).mockResolvedValue(1);
    vi.mocked(mockPrisma.trail.findMany).mockResolvedValue([makeTrail('trail-003')]);
    vi.mocked(mockPrisma.module.groupBy).mockResolvedValue([]);
    vi.mocked(mockPrisma.module.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.lesson.groupBy).mockResolvedValue([]);
    vi.mocked(mockPrisma.trailProgress.findMany).mockResolvedValue([
      makeProgress('trail-003', 100, new Date('2026-05-01T00:00:00Z')),
    ]);

    const result = await service.listMyTrails();
    expect(result.data[0]?.status).toBe('completed');
  });

  it('returns nextCursor when more pages exist', async () => {
    const trails = Array.from({ length: 11 }, (_, i) => makeTrail(`trail-${String(i).padStart(3, '0')}`));
    vi.mocked(mockPrisma.groupMember.findMany).mockResolvedValue([{ groupId: 'group-001' }]);
    vi.mocked(mockPrisma.groupTrail.findMany).mockResolvedValue(trails.map((t) => ({ trailId: t.id })));
    vi.mocked(mockPrisma.trail.count).mockResolvedValue(11);
    vi.mocked(mockPrisma.trail.findMany).mockResolvedValue(trails); // 11 > limit(10)
    vi.mocked(mockPrisma.module.groupBy).mockResolvedValue([]);
    vi.mocked(mockPrisma.module.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.lesson.groupBy).mockResolvedValue([]);
    vi.mocked(mockPrisma.trailProgress.findMany).mockResolvedValue([]);

    const result = await service.listMyTrails(undefined, 10);
    expect(result.data).toHaveLength(10);
    expect(result.meta.nextCursor).toBe('trail-009');
  });

  it('sorts: in_progress first, not_started second, completed last', async () => {
    vi.mocked(mockPrisma.groupMember.findMany).mockResolvedValue([{ groupId: 'g' }]);
    vi.mocked(mockPrisma.groupTrail.findMany).mockResolvedValue([
      { trailId: 'a' }, { trailId: 'b' }, { trailId: 'c' },
    ]);
    vi.mocked(mockPrisma.trail.count).mockResolvedValue(3);
    vi.mocked(mockPrisma.trail.findMany).mockResolvedValue([
      makeTrail('a'), makeTrail('b'), makeTrail('c'),
    ]);
    vi.mocked(mockPrisma.module.groupBy).mockResolvedValue([]);
    vi.mocked(mockPrisma.module.findMany).mockResolvedValue([]);
    vi.mocked(mockPrisma.lesson.groupBy).mockResolvedValue([]);
    vi.mocked(mockPrisma.trailProgress.findMany).mockResolvedValue([
      makeProgress('a', 0),               // not_started (percent=0)
      makeProgress('b', 50),              // in_progress
      makeProgress('c', 100, new Date()), // completed
    ]);

    const result = await service.listMyTrails();
    const statuses = result.data.map((d) => d.status);
    expect(statuses).toEqual(['in_progress', 'not_started', 'completed']);
  });
});
