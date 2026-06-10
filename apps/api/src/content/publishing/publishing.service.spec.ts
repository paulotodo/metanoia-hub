import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PublishingService } from './publishing.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(async (_prisma: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    return fn(mockTx);
  }),
}));

vi.mock('../../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: 'aaaaaaaa-aaaa-7000-8000-000000000001',
    userId: 'bbbbbbbb-bbbb-7000-8000-000000000001',
  })),
}));

const TRAIL_ID = 'cccccccc-cccc-7000-8000-000000000001';

const mockTrail = {
  id: TRAIL_ID,
  tenantId: 'aaaaaaaa-aaaa-7000-8000-000000000001',
  name: 'Test Trail',
  description: null,
  status: 'draft' as const,
  accessMode: 'free' as const,
  version: null,
  publishedAt: null,
  publishedBy: null,
  catalogVisible: false,
  createdBy: 'bbbbbbbb-bbbb-7000-8000-000000000001',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};

const mockTx = {
  trail: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  module: {
    findMany: vi.fn(),
  },
  trailVersion: {
    create: vi.fn(),
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublishingService', () => {
  let service: PublishingService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: trail exists in draft state
    mockTx.trail.findFirst.mockResolvedValue(mockTrail);
    mockTx.trail.update.mockImplementation((_args: unknown) => {
      return Promise.resolve({
        ...mockTrail,
        status: 'published',
        version: 1,
        publishedAt: new Date('2026-06-15T10:00:00Z'),
        publishedBy: 'bbbbbbbb-bbbb-7000-8000-000000000001',
      });
    });
    mockTx.module.findMany.mockResolvedValue([]);
    mockTx.trailVersion.create.mockResolvedValue({});

    service = new PublishingService({} as never);
  });

  it('publishes a draft trail and returns version=1', async () => {
    const { trail, event } = await service.publishTrail(TRAIL_ID);

    expect(trail.status).toBe('published');
    expect(trail.version).toBe(1);
    expect(trail.publishedAt).toBeDefined();
    expect(trail.publishedBy).toBe('bbbbbbbb-bbbb-7000-8000-000000000001');
    expect(event.eventType).toBe('content.trail.published');
    expect(event.data.trailVersion).toBe(1);
    expect(event.data.trailId).toBe(TRAIL_ID);
  });

  it('increments version on re-publish', async () => {
    const publishedTrail = {
      ...mockTrail,
      status: 'published' as const,
      version: 2,
    };
    mockTx.trail.findFirst.mockResolvedValue(publishedTrail);
    mockTx.trail.update.mockResolvedValue({
      ...publishedTrail,
      version: 3,
      publishedAt: new Date(),
    });

    const { trail, event } = await service.publishTrail(TRAIL_ID);

    const updateCall = mockTx.trail.update.mock.calls[0][0];
    expect(updateCall.data.version).toBe(3);
    expect(trail.version).toBe(3);
    expect(event.data.trailVersion).toBe(3);
  });

  it('throws NotFoundException when trail does not exist', async () => {
    mockTx.trail.findFirst.mockResolvedValue(null);
    await expect(service.publishTrail(TRAIL_ID)).rejects.toThrow(NotFoundException);
  });

  it('throws UnprocessableEntityException for archived trail', async () => {
    mockTx.trail.findFirst.mockResolvedValue({ ...mockTrail, status: 'archived' });
    await expect(service.publishTrail(TRAIL_ID)).rejects.toThrow(UnprocessableEntityException);
  });

  it('saves TrailVersion snapshot with correct version', async () => {
    await service.publishTrail(TRAIL_ID);

    const createCall = mockTx.trailVersion.create.mock.calls[0][0];
    expect(createCall.data.version).toBe(1);
    expect(createCall.data.trailId).toBe(TRAIL_ID);
    expect(createCall.data.tenantId).toBe('aaaaaaaa-aaaa-7000-8000-000000000001');
    expect(createCall.data.snapshotData).toBeDefined();
    expect(createCall.data.snapshotData.modules).toEqual([]);
  });

  it('domain event payload matches schema', async () => {
    const { event } = await service.publishTrail(TRAIL_ID);

    // Structural validation (Zod parse in service already validates — this is a smoke check)
    expect(event.eventType).toBe('content.trail.published');
    expect(event.version).toBe(1);
    expect(typeof event.eventId).toBe('string');
    expect(typeof event.tenantId).toBe('string');
    expect(typeof event.timestamp).toBe('string');
    expect(event.data.publishedBy).toBe('bbbbbbbb-bbbb-7000-8000-000000000001');
  });

  it('emits event with version=1 envelope (not trail version)', async () => {
    // The outer 'version' field of the domain event is always 1 (schema version)
    // The trail version is in event.data.trailVersion
    const { event } = await service.publishTrail(TRAIL_ID);
    expect(event.version).toBe(1); // schema version, always 1
    expect(event.data.trailVersion).toBe(1); // trail publish version
  });
});
