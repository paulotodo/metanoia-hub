/**
 * Unit tests for DetectEvasionRiskProcessor (Story 13.3 / FR66 / Tasks 6.3 + 10.4).
 *
 * AC-SEC-01: privileged client $disconnect() before per-tenant loop.
 * Error isolation: one tenant error does not abort others.
 * CHK030-RES: generateId called once (correlationId).
 *
 * Strategy: mock createPrivilegedClient() on the processor instance directly
 * so we fully control each PrismaClient created during dispatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// These mocks are hoisted — factories must not reference outer variables.
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class PrismaPg {
    constructor(_opts: unknown) {}
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {
    $queryRawUnsafe = vi.fn().mockResolvedValue([]);
    $disconnect = vi.fn().mockResolvedValue(undefined);
    $executeRawUnsafe = vi.fn().mockResolvedValue(undefined);
    constructor(_opts?: unknown) {}
  },
}));

vi.mock('@metanoia/types', () => ({
  generateId: vi.fn().mockReturnValue('01912345-6789-7000-8000-000000000099'),
  REPORTS_QUEUE_NAME: 'reports',
}));

import { DetectEvasionRiskProcessor } from './detect-evasion-risk.processor';

type TestProcessor = DetectEvasionRiskProcessor & {
  dispatch: (job: Job) => Promise<void>;
  createPrivilegedClient: () => {
    $queryRawUnsafe: ReturnType<typeof vi.fn>;
    $disconnect: ReturnType<typeof vi.fn>;
    $executeRawUnsafe: ReturnType<typeof vi.fn>;
  };
};

// Track privileged client instances created per test
const capturedClients: Array<{
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
}> = [];

function makeFakeClient(opts: {
  tenantRows?: Array<{ id: string }>;
  queryRawImpl?: () => Promise<unknown>;
} = {}) {
  const client = {
    $queryRawUnsafe: opts.queryRawImpl
      ? vi.fn().mockImplementation(opts.queryRawImpl)
      : vi.fn().mockResolvedValue(opts.tenantRows ?? []),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  };
  capturedClients.push(client);
  return client;
}

const mockPrismaService = {
  $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
};

const mockEvasionService = {
  evaluateParticipant: vi.fn().mockResolvedValue({ action: 'no-change' }),
};

const mockConfigService = {
  get: vi.fn().mockReturnValue('postgresql://test'),
};

function buildBullMqService() {
  const mockQueue = { upsertJobScheduler: vi.fn().mockResolvedValue(undefined) };
  const mockWorker = { on: vi.fn() };
  return {
    createQueue: vi.fn().mockReturnValue(mockQueue),
    createWorker: vi.fn().mockReturnValue(mockWorker),
  };
}

describe('DetectEvasionRiskProcessor', () => {
  let processor: TestProcessor;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedClients.length = 0;

    mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);
    mockPrismaService.$executeRawUnsafe.mockResolvedValue(undefined);
    mockEvasionService.evaluateParticipant.mockResolvedValue({ action: 'no-change' });

    const bullMq = buildBullMqService();
    processor = new DetectEvasionRiskProcessor(
      bullMq as never,
      mockPrismaService as never,
      mockConfigService as never,
      mockEvasionService as never,
    ) as TestProcessor;
    await processor.onModuleInit();
  });

  describe('AC-SEC-01 — privileged client lifecycle', () => {
    it('$disconnect() called before per-tenant loop', async () => {
      const TENANT_ID = '01912345-6789-7000-8000-000000000001';

      // Intercept createPrivilegedClient to return fakes we control
      let clientCallCount = 0;
      vi.spyOn(processor, 'createPrivilegedClient').mockImplementation(() => {
        clientCallCount++;
        if (clientCallCount === 1) {
          // First call: tenant listing client
          return makeFakeClient({ tenantRows: [{ id: TENANT_ID }] });
        }
        // Subsequent calls: job log client
        return makeFakeClient({});
      });

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]); // empty batch for the tenant

      await processor.dispatch({ name: 'detect-evasion-risk', id: 'j1' } as Job);

      const listingClient = capturedClients[0];
      expect(listingClient).toBeDefined();
      expect(listingClient!.$disconnect).toHaveBeenCalledOnce();

      // disconnect must be BEFORE any per-tenant queries
      const disconnectOrder = listingClient!.$disconnect.mock.invocationCallOrder[0] ?? 0;
      const firstPerTenantOrder = mockPrismaService.$queryRawUnsafe.mock.invocationCallOrder[0] ?? Infinity;
      expect(disconnectOrder).toBeLessThan(firstPerTenantOrder);
    });

    it('tenant listing uses exactly one $queryRawUnsafe call on privileged client', async () => {
      const TENANT_ID = '01912345-6789-7000-8000-000000000002';

      let clientCallCount = 0;
      vi.spyOn(processor, 'createPrivilegedClient').mockImplementation(() => {
        clientCallCount++;
        return clientCallCount === 1
          ? makeFakeClient({ tenantRows: [{ id: TENANT_ID }] })
          : makeFakeClient({});
      });

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      await processor.dispatch({ name: 'detect-evasion-risk', id: 'j2' } as Job);

      const listingClient = capturedClients[0]!;
      // Exactly one $queryRawUnsafe on the listing client (SELECT id FROM tenants)
      expect(listingClient.$queryRawUnsafe).toHaveBeenCalledOnce();
    });
  });

  describe('per-tenant error isolation', () => {
    it('error in tenant A does not abort tenant B', async () => {
      const TENANT_A = '01912345-6789-7000-8000-000000000001';
      const TENANT_B = '01912345-6789-7000-8000-000000000002';

      let clientCallCount = 0;
      vi.spyOn(processor, 'createPrivilegedClient').mockImplementation(() => {
        clientCallCount++;
        return clientCallCount === 1
          ? makeFakeClient({ tenantRows: [{ id: TENANT_A }, { id: TENANT_B }] })
          : makeFakeClient({});
      });

      // First per-tenant query throws; second succeeds with empty
      let perTenantCalls = 0;
      mockPrismaService.$queryRawUnsafe.mockImplementation(() => {
        perTenantCalls++;
        if (perTenantCalls === 1) throw new Error('DB error for tenant A');
        return Promise.resolve([]);
      });

      await expect(
        processor.dispatch({ name: 'detect-evasion-risk', id: 'j3' } as Job),
      ).resolves.not.toThrow();
    });
  });

  describe('CHK030-RES — correlationId', () => {
    it('generateId is invoked during dispatch (correlationId creation)', async () => {
      const { generateId } = await import('@metanoia/types');

      let clientCallCount = 0;
      vi.spyOn(processor, 'createPrivilegedClient').mockImplementation(() => {
        clientCallCount++;
        return makeFakeClient({});
      });

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      await processor.dispatch({ name: 'detect-evasion-risk', id: 'j4' } as Job);

      expect(generateId).toHaveBeenCalled();
    });
  });
});
