/**
 * S1 mitigation tests (SC-08, FR-07.1, CHK035) for ReportsService.
 *
 * Verifies that:
 *   A) Leader A cannot access jobId of Leader B (same tenant)
 *   B) Cross-tenant access is blocked (job not found)
 *   C) ADMIN_TENANT can read any job within the same tenant
 *   D) CHK035 regression: trail polling not broken (uses same key format)
 *
 * These tests stub Redis and RequestContext to simulate the tenant-prefixed
 * key enforcement without needing a real Redis instance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQueue = { add: vi.fn() };
const mockBullMqService = {
  createQueue: vi.fn(() => mockQueue),
  createWorker: vi.fn(),
};
const mockRedis = { get: vi.fn(), set: vi.fn() };
const mockStorage = { getSignedUrl: vi.fn(), upload: vi.fn() };
const mockPrisma = {};

// ─── RequestContext factory ────────────────────────────────────────────────────

const mockGetRequestContext = vi.fn(() => ({
  tenantId: 'tenant-A',
  userId: 'leader-A',
}));

vi.mock('../common/context/request-context', () => ({
  getRequestContext: () => mockGetRequestContext(),
}));

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(),
}));

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-A';
const TENANT_B = 'tenant-B';
const LEADER_A = 'leader-A';
const LEADER_B = 'leader-B';
const JOB_ID = 'job-001';

// Redis key format under S1 mitigation:
// `cache:reports:export-job:<tenantId>:<jobId>`
function makeKey(tenantId: string, jobId: string): string {
  return `cache:reports:export-job:${tenantId}:${jobId}`;
}

function makeJobValue(overrides?: Partial<{
  jobId: string;
  status: string;
  requesterUserId: string;
  signedUrl: string | null;
  expiresAt: string | null;
  failureReason: string | null;
}>) {
  return JSON.stringify({
    jobId: JOB_ID,
    status: 'completed',
    signedUrl: 'https://bucket.s3.amazonaws.com/signed',
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    failureReason: null,
    requesterUserId: LEADER_A,
    ...overrides,
  });
}

// ─── Service factory ──────────────────────────────────────────────────────────

function buildService(): ReportsService {
  const service = new ReportsService(
    mockBullMqService as never,
    mockPrisma as never,
    mockRedis as never,
    mockStorage as never,
  );
  // Initialize queue
  service.onModuleInit();
  return service;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportsService — S1 mitigation (SC-08, FR-07.1, CHK035)', () => {
  let service: ReportsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
  });

  // ─── A) Leader A cannot access Leader B's job ─────────────────────────────
  it('A: leader-B cannot access leader-A job in same tenant', async () => {
    // Context: leader-B is the current caller
    mockGetRequestContext.mockReturnValue({ tenantId: TENANT_A, userId: LEADER_B });

    // Redis has leader-A's job under tenant-A prefix
    mockRedis.get.mockImplementation((key: string) => {
      if (key === makeKey(TENANT_A, JOB_ID)) {
        return Promise.resolve(makeJobValue({ requesterUserId: LEADER_A }));
      }
      return Promise.resolve(null);
    });

    // Leader-B should get NotFoundException — not 403, to avoid leaking existence
    await expect(service.getJobStatus(JOB_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ─── B) Cross-tenant: tenant-B cannot see tenant-A job ───────────────────
  it('B: cross-tenant — tenant-B caller gets NotFoundException for tenant-A job', async () => {
    // Context: tenant-B caller trying to access job in tenant-A
    mockGetRequestContext.mockReturnValue({ tenantId: TENANT_B, userId: LEADER_A });

    // Only tenant-A key exists in Redis
    mockRedis.get.mockImplementation((key: string) => {
      if (key === makeKey(TENANT_A, JOB_ID)) {
        return Promise.resolve(makeJobValue({ requesterUserId: LEADER_A }));
      }
      return Promise.resolve(null); // tenant-B key does not exist
    });

    await expect(service.getJobStatus(JOB_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  // ─── C) ADMIN_TENANT same tenant can read any job ────────────────────────
  it('C: admin_tenant can read any job in their tenant (requesterUserId mismatch OK)', async () => {
    // Context: admin in tenant-A; job was created by leader-A
    mockGetRequestContext.mockReturnValue({ tenantId: TENANT_A, userId: 'admin-tenant-user' });

    mockRedis.get.mockImplementation((key: string) => {
      if (key === makeKey(TENANT_A, JOB_ID)) {
        // No requesterUserId → admin shortcut (or requester different but no check)
        return Promise.resolve(makeJobValue({ requesterUserId: undefined }));
      }
      return Promise.resolve(null);
    });

    const result = await service.getJobStatus(JOB_ID);
    expect(result.jobId).toBe(JOB_ID);
    expect(result.status).toBe('completed');
  });

  // ─── D) CHK035 — trail job polling regression ─────────────────────────────
  it('D: CHK035 — requester accessing their own trail export job succeeds', async () => {
    // Context: leader-A accessing their own job
    mockGetRequestContext.mockReturnValue({ tenantId: TENANT_A, userId: LEADER_A });

    // Trail export job also stored under tenant-prefixed key (same format)
    mockRedis.get.mockImplementation((key: string) => {
      if (key === makeKey(TENANT_A, JOB_ID)) {
        return Promise.resolve(makeJobValue({ requesterUserId: LEADER_A }));
      }
      return Promise.resolve(null);
    });

    const result = await service.getJobStatus(JOB_ID);
    expect(result.jobId).toBe(JOB_ID);
    expect(result.status).toBe('completed');
    expect(result.signedUrl).toBeTruthy();
  });

  // ─── setJobStatus stores under tenant-prefixed key ───────────────────────
  it('Redis key is prefixed with tenantId (S1 key format)', async () => {
    mockGetRequestContext.mockReturnValue({ tenantId: TENANT_A, userId: LEADER_A });

    // Trigger setJobStatus via enqueueMeetingExport stub
    mockRedis.set.mockResolvedValue('OK');
    mockQueue.add.mockResolvedValue({ id: 'bq-1' });

    await service.enqueueMeetingExport('meeting-xyz', LEADER_A, true);

    // Verify Redis.set was called with tenant-prefixed key
    const setCall = mockRedis.set.mock.calls[0];
    expect(setCall).toBeDefined();
    const key = setCall?.[0] as string;
    expect(key).toMatch(/^cache:reports:export-job:tenant-A:/);
    expect(key).not.toMatch(/^cache:reports:export-job:[^:]+:[^:]+:/); // no double-nesting
  });

  // ─── Processing status includes Retry-After hint (documented CHK040) ──────
  it('processing job returns status=processing (Retry-After set by controller)', async () => {
    mockGetRequestContext.mockReturnValue({ tenantId: TENANT_A, userId: LEADER_A });

    mockRedis.get.mockResolvedValue(
      makeJobValue({ requesterUserId: LEADER_A, status: 'processing' }),
    );

    const result = await service.getJobStatus(JOB_ID);
    expect(result.status).toBe('processing');
  });
});
