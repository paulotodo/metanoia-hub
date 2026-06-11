/**
 * Unit tests for AuditService.
 *
 * Covers:
 *   - createEvent: writes to DB via withTenantTx; swallows errors (FR-INFRA-01)
 *   - createEvent: truncates large payloads (dec-019)
 *   - listEvents: tenant-scoped (withTenantTx) vs cross-tenant (prisma.client, dec-015)
 *   - listEvents: filters applied (action, severity, userId, q, dates)
 *   - listEvents: pagination (offset, perPage)
 *   - createExportJob: enqueues BullMQ job + writes Redis state
 *   - getExportJobStatus: returns parsed Redis state; throws 404 when absent
 *
 * Story 9-3 (LGPD — Immutable Audit Log) — FASE 2.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AuditService, type CreateAuditEventDto } from './audit.service';
import { AUDIT_PAYLOAD_TRUNCATE_BYTES, AUDIT_EXPORT_QUEUE_NAME } from '@metanoia/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQueue = { add: vi.fn() };
const mockBullMqService = {
  createQueue: vi.fn(() => mockQueue),
  createWorker: vi.fn(),
};
const mockRedis = { get: vi.fn(), set: vi.fn() };

const mockAuditEvent = {
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
};

const mockTx = {
  auditEvent: mockAuditEvent,
  $executeRawUnsafe: vi.fn(),
};

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(
    (_prisma: unknown, fn: (tx: typeof mockTx) => Promise<unknown>, _opts?: unknown) =>
      fn(mockTx),
  ),
}));

// prisma.client mock for cross-tenant reads (dec-015)
const mockClientAuditEvent = {
  findMany: vi.fn(),
  count: vi.fn(),
};

const mockPrisma = {
  client: {
    auditEvent: mockClientAuditEvent,
  },
};

vi.mock('./audit-context', () => ({
  getAuditPreviousState: vi.fn(() => null),
  setAuditPreviousState: vi.fn(),
  auditContext: { run: vi.fn(), getStore: vi.fn(() => null) },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDto(overrides: Partial<CreateAuditEventDto> = {}): CreateAuditEventDto {
  return {
    userId: 'user-01',
    action: 'create',
    resource: 'group',
    resourceId: 'group-01',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest/test',
    newState: { id: 'group-01', name: 'Test Group' },
    ...overrides,
  };
}

type AuditRow = {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  previousState: null;
  newState: Record<string, unknown>;
  timestamp: Date;
  severity: string;
};

function makeRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: 'evt-01',
    tenantId: 'tenant-01',
    userId: 'user-01',
    action: 'create',
    resource: 'group',
    resourceId: 'group-01',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest/test',
    previousState: null,
    newState: { id: 'group-01' },
    timestamp: new Date('2026-06-11T10:00:00Z'),
    severity: 'info',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditEvent.create.mockResolvedValue({});
    mockAuditEvent.findMany.mockResolvedValue([]);
    mockAuditEvent.count.mockResolvedValue(0);
    mockClientAuditEvent.findMany.mockResolvedValue([]);
    mockClientAuditEvent.count.mockResolvedValue(0);

    service = new AuditService(
      mockPrisma as unknown as ConstructorParameters<typeof AuditService>[0],
      mockBullMqService as unknown as ConstructorParameters<typeof AuditService>[1],
      mockRedis as unknown as ConstructorParameters<typeof AuditService>[2],
    );
    service.onModuleInit();
  });

  // ─── createEvent ─────────────────────────────────────────────────────────────

  describe('createEvent', () => {
    it('creates audit event via withTenantTx (RLS)', async () => {
      await service.createEvent(makeDto());

      expect(mockAuditEvent.create).toHaveBeenCalledOnce();
      const { data } = mockAuditEvent.create.mock.calls[0]![0];
      expect(data.action).toBe('create');
      expect(data.resource).toBe('group');
      expect(data.severity).toBe('info');
    });

    it('assigns correct severity for delete action', async () => {
      await service.createEvent(makeDto({ action: 'delete' }));

      const { data } = mockAuditEvent.create.mock.calls[0]![0];
      expect(data.severity).toBe('critical');
    });

    it('assigns warning severity for update on role resource', async () => {
      await service.createEvent(makeDto({ action: 'update', resource: 'role' }));

      const { data } = mockAuditEvent.create.mock.calls[0]![0];
      expect(data.severity).toBe('warning');
    });

    it('swallows DB errors (FR-INFRA-01)', async () => {
      mockAuditEvent.create.mockRejectedValue(new Error('DB connection lost'));

      // Must NOT throw
      await expect(service.createEvent(makeDto())).resolves.toBeUndefined();
    });

    it('truncates newState payload > 64KB (dec-019)', async () => {
      const largeObject = { data: 'x'.repeat(AUDIT_PAYLOAD_TRUNCATE_BYTES + 1) };
      await service.createEvent(makeDto({ newState: largeObject }));

      const { data } = mockAuditEvent.create.mock.calls[0]![0];
      expect(data.newState).toMatchObject({
        __truncated: true,
        __originalSize: expect.any(Number),
        __sample: expect.any(String),
      });
    });

    it('stores null previousState when AuditContext not set', async () => {
      await service.createEvent(makeDto());

      const { data } = mockAuditEvent.create.mock.calls[0]![0];
      // previousState=null → Prisma undefined (omit field) per service logic
      expect(data.previousState).toBeUndefined();
    });

    it('accepts null userId (public endpoint — SEC-008)', async () => {
      await service.createEvent(makeDto({ userId: null }));

      const { data } = mockAuditEvent.create.mock.calls[0]![0];
      expect(data.userId).toBeNull();
    });

    it('does NOT expose update() or delete() methods (SEC-002)', () => {
      expect((service as unknown as Record<string, unknown>)['update']).toBeUndefined();
      expect((service as unknown as Record<string, unknown>)['delete']).toBeUndefined();
      expect((service as unknown as Record<string, unknown>)['deleteEvent']).toBeUndefined();
      expect((service as unknown as Record<string, unknown>)['updateEvent']).toBeUndefined();
    });
  });

  // ─── listEvents (tenant-scoped) ───────────────────────────────────────────

  describe('listEvents — tenant-scoped', () => {
    it('returns empty list when no events', async () => {
      const result = await service.listEvents({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('maps rows to AuditEventListResponse shape', async () => {
      const row = makeRow();
      mockAuditEvent.findMany.mockResolvedValue([row]);
      mockAuditEvent.count.mockResolvedValue(1);

      const result = await service.listEvents({ page: 1, perPage: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'evt-01',
        tenantId: 'tenant-01',
        action: 'create',
        resource: 'group',
        timestamp: '2026-06-11T10:00:00.000Z',
        severity: 'info',
      });
      expect(result.meta).toMatchObject({ page: 1, perPage: 10, total: 1, totalPages: 1 });
    });

    it('applies action filter', async () => {
      await service.listEvents({ page: 1, perPage: 10, action: 'delete' });

      const where = mockAuditEvent.findMany.mock.calls[0]?.[0]?.where;
      expect(where.action).toBe('delete');
    });

    it('applies severity filter', async () => {
      await service.listEvents({ page: 1, perPage: 10, severity: 'critical' });

      const where = mockAuditEvent.findMany.mock.calls[0]?.[0]?.where;
      expect(where.severity).toBe('critical');
    });

    it('applies userId filter', async () => {
      await service.listEvents({ page: 1, perPage: 10, userId: 'user-xyz' });

      const where = mockAuditEvent.findMany.mock.calls[0]?.[0]?.where;
      expect(where.userId).toBe('user-xyz');
    });

    it('applies q filter as ILIKE on resource + resourceId (dec-020)', async () => {
      await service.listEvents({ page: 1, perPage: 10, q: 'group' });

      const where = mockAuditEvent.findMany.mock.calls[0]?.[0]?.where;
      expect(where.OR).toEqual([
        { resource: { contains: 'group', mode: 'insensitive' } },
        { resourceId: { contains: 'group', mode: 'insensitive' } },
      ]);
    });

    it('applies dateFrom + dateTo filters', async () => {
      const dateFrom = '2026-01-01T00:00:00Z';
      const dateTo = '2026-12-31T23:59:59Z';
      await service.listEvents({ page: 1, perPage: 10, dateFrom, dateTo });

      const where = mockAuditEvent.findMany.mock.calls[0]?.[0]?.where;
      expect(where.timestamp.gte).toEqual(new Date(dateFrom));
      expect(where.timestamp.lte).toEqual(new Date(dateTo));
    });

    it('computes correct skip for page 2 perPage 10 (dec-022)', async () => {
      await service.listEvents({ page: 2, perPage: 10 });

      const args = mockAuditEvent.findMany.mock.calls[0]?.[0];
      expect(args?.skip).toBe(10);
      expect(args?.take).toBe(10);
    });

    it('orders by timestamp desc', async () => {
      await service.listEvents({ page: 1, perPage: 10 });

      const args = mockAuditEvent.findMany.mock.calls[0]?.[0];
      expect(args?.orderBy).toEqual({ timestamp: 'desc' });
    });

    it('uses withTenantTx for tenant-scoped reads (RLS)', async () => {
      const { withTenantTx } = await import('../prisma/with-tenant-tx');
      await service.listEvents({ page: 1, perPage: 10 });

      expect(withTenantTx).toHaveBeenCalled();
      // prisma.client should NOT be used
      expect(mockClientAuditEvent.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── listEvents (cross-tenant / super admin) ──────────────────────────────

  describe('listEvents — cross-tenant (Super Admin)', () => {
    it('uses prisma.client when tenantId provided (dec-015 / SEC-005)', async () => {
      const row = makeRow({ tenantId: 'tenant-B' });
      mockClientAuditEvent.findMany.mockResolvedValue([row]);
      mockClientAuditEvent.count.mockResolvedValue(1);

      const result = await service.listEvents({ page: 1, perPage: 10 }, 'tenant-B');

      expect(mockClientAuditEvent.findMany).toHaveBeenCalled();
      expect(mockAuditEvent.findMany).not.toHaveBeenCalled();
      expect(result.data[0]?.tenantId).toBe('tenant-B');
    });

    it('adds tenantId to where clause for cross-tenant query', async () => {
      await service.listEvents({ page: 1, perPage: 10 }, 'tenant-B');

      const where = mockClientAuditEvent.findMany.mock.calls[0]?.[0]?.where;
      expect(where?.tenantId).toBe('tenant-B');
    });
  });

  // ─── createExportJob ─────────────────────────────────────────────────────

  describe('createExportJob', () => {
    it('enqueues job in BullMQ queue (AUDIT_EXPORT_QUEUE_NAME)', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.createExportJob({}, null, 'user-01');

      expect(mockBullMqService.createQueue).toHaveBeenCalledWith(AUDIT_EXPORT_QUEUE_NAME);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'export-audit-csv',
        expect.objectContaining({ requestedBy: 'user-01' }),
        expect.objectContaining({ removeOnComplete: true, removeOnFail: true }),
      );
      expect(result.jobId).toBeTruthy();
    });

    it('writes processing state to Redis with TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const { jobId } = await service.createExportJob({}, null, 'user-01');

      expect(mockRedis.set).toHaveBeenCalledWith(
        `cache:audit:export-job:${jobId}`,
        expect.stringContaining('"status":"processing"'),
        'EX',
        expect.any(Number),
      );
    });
  });

  // ─── getExportJobStatus ───────────────────────────────────────────────────

  describe('getExportJobStatus', () => {
    it('returns parsed job status from Redis', async () => {
      const jobState = {
        jobId: 'job-01',
        status: 'completed',
        signedUrl: 'https://minio/audit-exports/job-01.csv',
        expiresAt: '2026-06-12T10:00:00Z',
        failureReason: null,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(jobState));

      const result = await service.getExportJobStatus('job-01');

      expect(result.status).toBe('completed');
      expect(result.signedUrl).toBe('https://minio/audit-exports/job-01.csv');
    });

    it('throws NotFoundException when job not in Redis (expired or never existed)', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.getExportJobStatus('job-missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
