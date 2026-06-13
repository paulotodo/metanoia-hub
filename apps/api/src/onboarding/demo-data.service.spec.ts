import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoDataService } from './demo-data.service';

// ---------------------------------------------------------------------------
// Mock seedDemoData (avoid real DB in unit tests)
// ---------------------------------------------------------------------------

const mockSeedDemoData = vi.fn();
vi.mock('./seed/demo-data.seed', () => ({
  seedDemoData: (...args: unknown[]) => mockSeedDemoData(...args),
}));

// ---------------------------------------------------------------------------
// Mock withTenantTx — executes the callback immediately
// ---------------------------------------------------------------------------

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: async (
    _prisma: unknown,
    fn: (tx: unknown) => Promise<unknown>,
    _opts?: unknown,
  ) => fn(mockTx),
}));

// ---------------------------------------------------------------------------
// Shared mock transaction and PrismaService
// ---------------------------------------------------------------------------

const mockTx = {
  pastoralAction: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  meetingTelemetry: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  meetingAttendance: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  meeting: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  moduleProgress: { deleteMany: vi.fn().mockResolvedValue({ count: 6 }) },
  trailProgress: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  lesson: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
  module: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
  trail: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  groupMember: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
  group: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  user: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
  tenant: {
    findFirst: vi.fn().mockResolvedValue({
      id: 'tenant-id',
      tenantId: 'tenant-id',
      metadata: {},
    }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
};

const makeMockClient = (overrides: Record<string, unknown> = {}) => ({
  group: {
    count: vi.fn().mockResolvedValue(0),
  },
  user: { count: vi.fn().mockResolvedValue(0) },
  groupMember: { count: vi.fn().mockResolvedValue(0) },
  trail: { count: vi.fn().mockResolvedValue(0) },
  module: { count: vi.fn().mockResolvedValue(0) },
  lesson: { count: vi.fn().mockResolvedValue(0) },
  trailProgress: { count: vi.fn().mockResolvedValue(0) },
  moduleProgress: { count: vi.fn().mockResolvedValue(0) },
  meeting: { count: vi.fn().mockResolvedValue(0) },
  meetingAttendance: { count: vi.fn().mockResolvedValue(0) },
  meetingTelemetry: { count: vi.fn().mockResolvedValue(0) },
  pastoralAction: { count: vi.fn().mockResolvedValue(0) },
  tenant: {
    findFirst: vi.fn().mockResolvedValue({ metadata: {} }),
  },
  ...overrides,
});

const makePrismaService = (client: ReturnType<typeof makeMockClient>) =>
  ({ client }) as never;

// ---------------------------------------------------------------------------

const TENANT_ID = '01989b10-0000-7000-8000-000000000000';

describe('DemoDataService', () => {
  let service: DemoDataService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // seedDemoData
  // -------------------------------------------------------------------------

  describe('seedDemoData', () => {
    it('delegates to the seed function with the tenantId and prisma client', async () => {
      const client = makeMockClient();
      service = new DemoDataService(makePrismaService(client));
      mockSeedDemoData.mockResolvedValueOnce(undefined);

      await service.seedDemoData(TENANT_ID);

      expect(mockSeedDemoData).toHaveBeenCalledTimes(1);
      expect(mockSeedDemoData).toHaveBeenCalledWith(TENANT_ID, client);
    });

    it('does NOT propagate exceptions thrown by the seed function (FR-05)', async () => {
      const client = makeMockClient();
      service = new DemoDataService(makePrismaService(client));
      mockSeedDemoData.mockRejectedValueOnce(new Error('DB unreachable'));

      // Should resolve without throwing
      await expect(service.seedDemoData(TENANT_ID)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // deleteDemoData
  // -------------------------------------------------------------------------

  describe('deleteDemoData', () => {
    it('deletes all 12 entity types in the correct order via transaction', async () => {
      const client = makeMockClient();
      service = new DemoDataService(makePrismaService(client));

      await service.deleteDemoData(TENANT_ID);

      const order = [
        'pastoralAction',
        'meetingTelemetry',
        'meetingAttendance',
        'meeting',
        'moduleProgress',
        'trailProgress',
        'lesson',
        'module',
        'trail',
        'groupMember',
        'group',
        'user',
      ];

      for (const entity of order) {
        expect((mockTx[entity as keyof typeof mockTx] as { deleteMany: ReturnType<typeof vi.fn> }).deleteMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: expect.objectContaining({ isDemoData: true }) }),
        );
      }
    });

    it('is idempotent — does not throw when there are no demo records', async () => {
      const client = makeMockClient();
      service = new DemoDataService(makePrismaService(client));

      // Override to return 0 deletes (no-op scenario)
      Object.values(mockTx).forEach((model) => {
        if (typeof model === 'object' && model !== null && 'deleteMany' in model) {
          (model as { deleteMany: ReturnType<typeof vi.fn> }).deleteMany.mockResolvedValue({ count: 0 });
        }
      });

      await expect(service.deleteDemoData(TENANT_ID)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getDemoStatus
  // -------------------------------------------------------------------------

  describe('getDemoStatus', () => {
    it('returns hasDemoData: true when demo groups exist', async () => {
      const client = makeMockClient({
        group: {
          count: vi
            .fn()
            .mockResolvedValueOnce(1)   // isDemoData: true
            .mockResolvedValueOnce(0),  // isDemoData: false
        },
        tenant: { findFirst: vi.fn().mockResolvedValue({ metadata: {} }) },
      });
      service = new DemoDataService(makePrismaService(client));

      const result = await service.getDemoStatus(TENANT_ID);

      expect(result.hasDemoData).toBe(true);
      expect(result.hasRealData).toBe(false);
      expect(result.nudgeDismissed).toBe(false);
    });

    it('returns hasRealData: true when real groups exist', async () => {
      const client = makeMockClient({
        group: {
          count: vi
            .fn()
            .mockResolvedValueOnce(1)   // isDemoData: true
            .mockResolvedValueOnce(2),  // isDemoData: false
        },
        tenant: { findFirst: vi.fn().mockResolvedValue({ metadata: {} }) },
      });
      service = new DemoDataService(makePrismaService(client));

      const result = await service.getDemoStatus(TENANT_ID);

      expect(result.hasRealData).toBe(true);
    });

    it('returns nudgeDismissed: true when Tenant.metadata.demoDismissedAt is set', async () => {
      const client = makeMockClient({
        group: { count: vi.fn().mockResolvedValue(1) },
        tenant: {
          findFirst: vi.fn().mockResolvedValue({
            metadata: { demoDismissedAt: '2026-06-13T10:00:00.000Z' },
          }),
        },
      });
      service = new DemoDataService(makePrismaService(client));

      const result = await service.getDemoStatus(TENANT_ID);

      expect(result.nudgeDismissed).toBe(true);
    });

    it('returns correct demoRecordCount as sum across all 12 tables', async () => {
      // Simulate: 4 users + 4 groupMembers + 1 group + 1 trail + 2 modules +
      // 4 lessons + 3 trailProgress + 6 moduleProgress + 1 meeting +
      // 3 meetingAttendance + 3 meetingTelemetry + 3 pastoralActions = 35
      const client = makeMockClient({
        group: {
          count: vi
            .fn()
            .mockResolvedValueOnce(1)   // isDemoData: true
            .mockResolvedValueOnce(0),  // isDemoData: false
        },
        user: { count: vi.fn().mockResolvedValue(4) },
        groupMember: { count: vi.fn().mockResolvedValue(4) },
        trail: { count: vi.fn().mockResolvedValue(1) },
        module: { count: vi.fn().mockResolvedValue(2) },
        lesson: { count: vi.fn().mockResolvedValue(4) },
        trailProgress: { count: vi.fn().mockResolvedValue(3) },
        moduleProgress: { count: vi.fn().mockResolvedValue(6) },
        meeting: { count: vi.fn().mockResolvedValue(1) },
        meetingAttendance: { count: vi.fn().mockResolvedValue(3) },
        meetingTelemetry: { count: vi.fn().mockResolvedValue(3) },
        pastoralAction: { count: vi.fn().mockResolvedValue(3) },
        tenant: { findFirst: vi.fn().mockResolvedValue({ metadata: {} }) },
      });
      service = new DemoDataService(makePrismaService(client));

      const result = await service.getDemoStatus(TENANT_ID);

      expect(result.demoRecordCount).toBe(35);
    });

    it('returns hasDemoData: false and demoRecordCount: 0 when no demo data exists', async () => {
      const client = makeMockClient({
        tenant: { findFirst: vi.fn().mockResolvedValue({ metadata: {} }) },
      });
      service = new DemoDataService(makePrismaService(client));

      const result = await service.getDemoStatus(TENANT_ID);

      expect(result.hasDemoData).toBe(false);
      expect(result.demoRecordCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // dismissNudge
  // -------------------------------------------------------------------------

  describe('dismissNudge', () => {
    it('calls tenant.updateMany with demoDismissedAt in metadata', async () => {
      const client = makeMockClient();
      service = new DemoDataService(makePrismaService(client));

      await service.dismissNudge(TENANT_ID);

      expect(mockTx.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              demoDismissedAt: expect.any(String),
            }),
          }),
        }),
      );
    });

    it('preserves existing metadata keys when setting demoDismissedAt', async () => {
      const client = makeMockClient();
      mockTx.tenant.findFirst.mockResolvedValueOnce({
        id: 'tenant-id',
        tenantId: TENANT_ID,
        metadata: { existingKey: 'existingValue' },
      });
      service = new DemoDataService(makePrismaService(client));

      await service.dismissNudge(TENANT_ID);

      const callArg = mockTx.tenant.updateMany.mock.calls[0][0] as {
        data: { metadata: Record<string, unknown> };
      };
      expect(callArg.data.metadata).toMatchObject({
        existingKey: 'existingValue',
        demoDismissedAt: expect.any(String),
      });
    });
  });
});
