import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { GroupTrailsService } from './group-trails.service';
import type { GroupTrailsRepository } from './group-trails.repository';
import type { GroupTrail } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock request context
// ---------------------------------------------------------------------------
vi.mock('../../common/context/request-context', () => ({
  getRequestContext: () => ({
    tenantId: 'aaaaaaaa-0000-7000-8000-000000000001',
    userId: 'aaaaaaaa-0000-7000-8000-000000000002',
    requestId: 'req-test',
    correlationId: 'corr-test',
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeGroupTrail(override: Partial<GroupTrail> = {}): GroupTrail {
  return {
    id: '019756c0-0001-7000-8000-000000000060',
    tenantId: 'aaaaaaaa-0000-7000-8000-000000000001',
    groupId: '019756c0-0001-7000-8000-000000000070',
    trailId: '019756c0-0001-7000-8000-000000000010',
    assignedBy: 'aaaaaaaa-0000-7000-8000-000000000002',
    assignedAt: new Date('2026-06-10T10:00:00.000Z'),
    ...override,
  };
}

function makeRepository(): GroupTrailsRepository {
  return {
    findInvalidTrailIds: vi.fn().mockResolvedValue([]),
    bulkAssign: vi.fn().mockResolvedValue([makeGroupTrail()]),
    unassign: vi.fn().mockResolvedValue(makeGroupTrail()),
    listByGroup: vi.fn().mockResolvedValue([makeGroupTrail()]),
  } as unknown as GroupTrailsRepository;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GroupTrailsService', () => {
  let repo: GroupTrailsRepository;
  let service: GroupTrailsService;

  beforeEach(() => {
    repo = makeRepository();
    service = new GroupTrailsService(repo);
  });

  // ---- associateTrails ----

  it('calls bulkAssign and returns formatted response', async () => {
    const groupId = '019756c0-0001-7000-8000-000000000070';
    const trailIds = ['019756c0-0001-7000-8000-000000000010'];

    const result = await service.associateTrails(groupId, trailIds);

    expect(repo.findInvalidTrailIds).toHaveBeenCalledWith(trailIds);
    expect(repo.bulkAssign).toHaveBeenCalledWith([
      expect.objectContaining({ groupId, trailId: trailIds[0] }),
    ]);
    expect(result.meta.created).toBe(1);
    expect(result.data[0]).toMatchObject({
      groupId,
      trailId: trailIds[0],
    });
  });

  it('throws 422 with invalidTrailIds when some IDs not found', async () => {
    vi.mocked(repo.findInvalidTrailIds).mockResolvedValue([
      '019756c0-0001-7000-8000-000000000099',
    ]);

    const groupId = '019756c0-0001-7000-8000-000000000070';
    const trailIds = [
      '019756c0-0001-7000-8000-000000000010',
      '019756c0-0001-7000-8000-000000000099',
    ];

    await expect(service.associateTrails(groupId, trailIds)).rejects.toThrow(
      UnprocessableEntityException,
    );

    try {
      await service.associateTrails(groupId, trailIds);
    } catch (e) {
      const err = e as UnprocessableEntityException;
      const body = err.getResponse() as Record<string, unknown>;
      expect(body['statusCode']).toBe(422);
      expect(body['invalidTrailIds']).toContain('019756c0-0001-7000-8000-000000000099');
    }
  });

  // ---- unassignTrail ----

  it('calls unassign successfully', async () => {
    const groupId = '019756c0-0001-7000-8000-000000000070';
    const trailId = '019756c0-0001-7000-8000-000000000010';

    await expect(service.unassignTrail(groupId, trailId)).resolves.toBeUndefined();
    expect(repo.unassign).toHaveBeenCalledWith(groupId, trailId);
  });

  it('throws 404 when association not found', async () => {
    vi.mocked(repo.unassign).mockResolvedValue(null);

    await expect(
      service.unassignTrail(
        '019756c0-0001-7000-8000-000000000070',
        '019756c0-0001-7000-8000-000000000099',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ---- listTrails ----

  it('returns list response with total in meta', async () => {
    const result = await service.listTrails('019756c0-0001-7000-8000-000000000070');
    expect(result.meta.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });
});
