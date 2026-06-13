/**
 * Unit tests for PrivacyDeletionService (Story 9-2, FASE 4).
 *
 * Covers:
 *   - createJob: guardrail 422 LEADER_ACTIVE_GROUPS
 *   - createJob: idempotency (2x same userId → same requestId)
 *   - cancelRequest: OWASP A01/IDOR (user B cannot cancel user A's request → 404)
 *   - cancelRequest: expired grace period → 409
 *   - getStatus: OWASP A01/IDOR (user B cannot read user A's request → 404)
 *   - softDeleteAllTenants: replay-safe (cancelled status → no-op)
 *   - hardDeleteAllTenants: replay-safe (cancelled status → no-op)
 *   - handleJobFailure: marks status='failed'
 *   - PrivacyExportService.createJob: blocks when status='deletion_pending' → 409
 */
import { describe, it, expect, vi } from 'vitest';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrivacyDeletionService } from '../privacy-deletion.service';
import { PrivacyExportService } from '../privacy-export.service';

// Fixed UUIDs (v7 format) for deterministic tests
const USER_A_ID = '0197b600-0001-7000-8000-000000000001';
const USER_B_ID = '0197b600-0002-7000-8000-000000000002';
const TENANT_ID = '0197b600-0003-7000-8000-000000000003';
const REQUEST_ID = '0197b600-0004-7000-8000-000000000004';
const GROUP_ID = '0197b600-0005-7000-8000-000000000005';
const NOW = new Date('2026-06-20T00:00:00.000Z');
const CANCELLABLE_UNTIL = new Date('2026-06-27T00:00:00.000Z'); // +7d
const DELETION_DEADLINE = new Date('2026-07-20T00:00:00.000Z'); // +30d

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDeletionService(overrides: {
  groupMemberFindMany?: unknown[];
  deletionRequestFindFirst?: unknown;
  deletionRequestCreate?: unknown;
  deletionRequestUpdate?: unknown;
  userUpdate?: unknown;
  userTenantFindMany?: unknown[];
  $transaction?: (...args: unknown[]) => Promise<unknown>;
} = {}) {
  const {
    groupMemberFindMany = [],
    deletionRequestFindFirst = null,
    deletionRequestCreate = {},
    deletionRequestUpdate = {},
    userUpdate = {},
    userTenantFindMany = [{ tenantId: TENANT_ID }],
    $transaction,
  } = overrides;

  const prisma = {
    client: {
      groupMember: {
        findMany: vi.fn().mockResolvedValue(groupMemberFindMany),
      },
      deletionRequest: {
        findFirst: vi.fn().mockResolvedValue(deletionRequestFindFirst),
        create: vi.fn().mockResolvedValue(deletionRequestCreate),
        update: vi.fn().mockResolvedValue(deletionRequestUpdate),
      },
      user: {
        update: vi.fn().mockResolvedValue(userUpdate),
      },
      userTenant: {
        findMany: vi.fn().mockResolvedValue(userTenantFindMany),
      },
      $transaction: $transaction ?? vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        });
      }),
    },
  };

  const bullMqService = {
    createQueue: vi.fn().mockReturnValue({
      add: vi.fn().mockResolvedValue(undefined),
      getJob: vi.fn().mockResolvedValue(null),
    }),
  };

  const redis = { scan: vi.fn().mockResolvedValue(['0', []]), del: vi.fn().mockResolvedValue(0) };
  const storage = { bucket: 'test', client: { listObjects: vi.fn(), removeObject: vi.fn() } };

  const domainService = {
    softDeleteUserData: vi.fn().mockResolvedValue(undefined),
    hardDeleteUserData: vi.fn().mockResolvedValue(undefined),
  };

  const auditService = {
    softDeleteUserData: vi.fn().mockResolvedValue(undefined),
    hardDeleteUserData: vi.fn().mockResolvedValue(undefined),
    createEvent: vi.fn().mockResolvedValue(undefined),
  };

  const consentService = {
    softDeleteUserData: vi.fn().mockResolvedValue(undefined),
    hardDeleteUserData: vi.fn().mockResolvedValue(undefined),
  };

  const service = new PrivacyDeletionService(
    bullMqService as never,
    prisma as never,
    redis as never,
    storage as never,
    domainService as never, // usersService
    domainService as never, // groupMembersService
    domainService as never, // meetingsService
    domainService as never, // progressService
    domainService as never, // pastoralService
    consentService as never, // consentService
    auditService as never,  // auditService
  );

  // Manually inject queue (normally done in onModuleInit)
  (service as unknown as { queue: unknown }).queue = {
    add: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
  };

  return { service, prisma, bullMqService, domainService, auditService };
}

// ─── createJob ───────────────────────────────────────────────────────────────

describe('PrivacyDeletionService.createJob', () => {
  it('throws 422 LEADER_ACTIVE_GROUPS when user leads active groups', async () => {
    const { service } = makeDeletionService({
      groupMemberFindMany: [
        { group: { id: GROUP_ID, name: 'Célula Alpha' } },
      ],
    });

    await expect(service.createJob(USER_A_ID, TENANT_ID)).rejects.toThrow(
      UnprocessableEntityException,
    );

    try {
      await service.createJob(USER_A_ID, TENANT_ID);
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      const body = (err as UnprocessableEntityException).getResponse() as {
        error: string;
        groups: unknown[];
      };
      expect(body.error).toBe('LEADER_ACTIVE_GROUPS');
      expect(body.groups).toHaveLength(1);
      expect((body.groups[0] as { id: string }).id).toBe(GROUP_ID);
    }
  });

  it('is idempotent: returns same requestId for 2nd call when pending request exists', async () => {
    const existingRequest = {
      id: REQUEST_ID,
      status: 'pending',
      cancellableUntil: CANCELLABLE_UNTIL,
      deletionDeadline: DELETION_DEADLINE,
    };
    const { service, prisma } = makeDeletionService({
      groupMemberFindMany: [],
      deletionRequestFindFirst: existingRequest,
    });

    const result = await service.createJob(USER_A_ID, TENANT_ID);

    // Should return existing request, NOT create a new one
    expect(result.requestId).toBe(REQUEST_ID);
    expect(result.status).toBe('pending');
    expect(prisma.client.deletionRequest.create).not.toHaveBeenCalled();
  });

  it('creates a new DeletionRequest and sets user status=deletion_pending', async () => {
    const { service, prisma } = makeDeletionService({
      groupMemberFindMany: [],
      deletionRequestFindFirst: null,
    });

    const result = await service.createJob(USER_A_ID, TENANT_ID);

    expect(prisma.client.deletionRequest.create).toHaveBeenCalledOnce();
    const createCall = prisma.client.deletionRequest.create.mock.calls[0]?.[0] as {
      data: {
        userId: string;
        tenantId: string;
        status: string;
      };
    };
    expect(createCall.data.userId).toBe(USER_A_ID);
    expect(createCall.data.tenantId).toBe(TENANT_ID);
    expect(createCall.data.status).toBe('pending');

    expect(prisma.client.user.update).toHaveBeenCalledWith({
      where: { id: USER_A_ID },
      data: { status: 'deletion_pending' },
    });

    expect(result.status).toBe('pending');
    expect(result.cancellableUntil).toBeTruthy();
    expect(result.deletionDeadline).toBeTruthy();
  });

  it('enqueues soft-delete job with exponential backoff', async () => {
    const { service } = makeDeletionService({
      groupMemberFindMany: [],
      deletionRequestFindFirst: null,
    });

    await service.createJob(USER_A_ID, TENANT_ID);

    const queue = (service as unknown as { queue: { add: ReturnType<typeof vi.fn> } }).queue;
    const addCall = queue.add.mock.calls[0] as [
      string,
      unknown,
      { jobId: string; attempts: number; backoff: { type: string; delay: number } },
    ];
    expect(addCall[0]).toBe('soft-delete-user-data');
    expect(addCall[2].attempts).toBe(3);
    expect(addCall[2].backoff).toEqual({ type: 'exponential', delay: 60_000 });
  });
});

// ─── cancelRequest ────────────────────────────────────────────────────────────

describe('PrivacyDeletionService.cancelRequest', () => {
  it('returns 404 when request belongs to a different user (IDOR protection)', async () => {
    // findFirst with {id, userId} returns null → 404 (not 403 — prevents enumeration)
    const { service } = makeDeletionService({
      deletionRequestFindFirst: null,
    });

    await expect(service.cancelRequest(REQUEST_ID, USER_B_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns 409 when cancellation period has expired', async () => {
    const expiredRequest = {
      status: 'pending',
      cancellableUntil: new Date('2020-01-01T00:00:00.000Z'), // in the past
    };
    const { service } = makeDeletionService({
      deletionRequestFindFirst: expiredRequest,
    });

    await expect(service.cancelRequest(REQUEST_ID, USER_A_ID)).rejects.toThrow(
      ConflictException,
    );
  });

  it('updates status=cancelled and restores user.status=active on valid cancel', async () => {
    const validRequest = {
      status: 'pending',
      cancellableUntil: new Date(Date.now() + 86_400_000), // 1d in the future
    };
    const { service, prisma } = makeDeletionService({
      deletionRequestFindFirst: validRequest,
    });

    await service.cancelRequest(REQUEST_ID, USER_A_ID);

    const updateCall = prisma.client.deletionRequest.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { status: string; cancelledAt: Date };
    };
    expect(updateCall.where.id).toBe(REQUEST_ID);
    expect(updateCall.data.status).toBe('cancelled');

    expect(prisma.client.user.update).toHaveBeenCalledWith({
      where: { id: USER_A_ID },
      data: { status: 'active' },
    });
  });

  it('is idempotent for already-cancelled request (no-op)', async () => {
    const cancelledRequest = {
      status: 'cancelled',
      cancellableUntil: CANCELLABLE_UNTIL,
    };
    const { service, prisma } = makeDeletionService({
      deletionRequestFindFirst: cancelledRequest,
    });

    await service.cancelRequest(REQUEST_ID, USER_A_ID);

    expect(prisma.client.deletionRequest.update).not.toHaveBeenCalled();
  });
});

// ─── getStatus ────────────────────────────────────────────────────────────────

describe('PrivacyDeletionService.getStatus', () => {
  it('returns 404 when request belongs to a different user (IDOR protection)', async () => {
    const { service } = makeDeletionService({
      deletionRequestFindFirst: null, // findFirst({id, userId}) returns null for user B
    });

    await expect(service.getStatus(REQUEST_ID, USER_B_ID)).rejects.toThrow(NotFoundException);
  });

  it('returns status DTO for owner user', async () => {
    const ownedRequest = {
      id: REQUEST_ID,
      status: 'pending',
      cancellableUntil: CANCELLABLE_UNTIL,
      deletionDeadline: DELETION_DEADLINE,
      cancelledAt: null,
      completedAt: null,
      failureReason: null,
    };
    const { service } = makeDeletionService({
      deletionRequestFindFirst: ownedRequest,
    });

    const result = await service.getStatus(REQUEST_ID, USER_A_ID);

    expect(result.requestId).toBe(REQUEST_ID);
    expect(result.status).toBe('pending');
    expect(result.cancellableUntil).toBe(CANCELLABLE_UNTIL.toISOString());
    expect(result.cancelledAt).toBeNull();
    expect(result.completedAt).toBeNull();
    expect(result.failureReason).toBeNull();
  });
});

// ─── softDeleteAllTenants ─────────────────────────────────────────────────────

describe('PrivacyDeletionService.softDeleteAllTenants', () => {
  it('is replay-safe: no-op when request is cancelled', async () => {
    const { service, prisma, domainService } = makeDeletionService({
      deletionRequestFindFirst: { status: 'cancelled' },
    });

    await service.softDeleteAllTenants({
      requestId: REQUEST_ID,
      userId: USER_A_ID,
      allTenantIds: [TENANT_ID],
      requestedAt: NOW.toISOString(),
      cancellableUntil: CANCELLABLE_UNTIL.toISOString(),
      deletionDeadline: DELETION_DEADLINE.toISOString(),
    });

    expect(domainService.softDeleteUserData).not.toHaveBeenCalled();
    expect(prisma.client.deletionRequest.update).not.toHaveBeenCalled();
  });

  it('calls softDeleteUserData for each tenant when pending', async () => {
    const { service, domainService } = makeDeletionService({
      deletionRequestFindFirst: { status: 'pending' },
    });

    await service.softDeleteAllTenants({
      requestId: REQUEST_ID,
      userId: USER_A_ID,
      allTenantIds: [TENANT_ID],
      requestedAt: NOW.toISOString(),
      cancellableUntil: CANCELLABLE_UNTIL.toISOString(),
      deletionDeadline: DELETION_DEADLINE.toISOString(),
    });

    // Each domain service called once per tenant
    expect(domainService.softDeleteUserData).toHaveBeenCalledWith(USER_A_ID, TENANT_ID);
  });
});

// ─── hardDeleteAllTenants ─────────────────────────────────────────────────────

describe('PrivacyDeletionService.hardDeleteAllTenants', () => {
  it('is replay-safe: no-op when request is cancelled', async () => {
    const { service, domainService } = makeDeletionService({
      deletionRequestFindFirst: { status: 'cancelled' },
    });

    await service.hardDeleteAllTenants({
      requestId: REQUEST_ID,
      userId: USER_A_ID,
      allTenantIds: [TENANT_ID],
      requestedAt: NOW.toISOString(),
      cancellableUntil: CANCELLABLE_UNTIL.toISOString(),
      deletionDeadline: DELETION_DEADLINE.toISOString(),
    });

    expect(domainService.hardDeleteUserData).not.toHaveBeenCalled();
  });

  it('marks request as hard_deleted with completedAt after execution', async () => {
    const { service, prisma } = makeDeletionService({
      deletionRequestFindFirst: { status: 'soft_deleted' },
    });

    await service.hardDeleteAllTenants({
      requestId: REQUEST_ID,
      userId: USER_A_ID,
      allTenantIds: [TENANT_ID],
      requestedAt: NOW.toISOString(),
      cancellableUntil: CANCELLABLE_UNTIL.toISOString(),
      deletionDeadline: DELETION_DEADLINE.toISOString(),
    });

    const updateCall = prisma.client.deletionRequest.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { data: { status?: string } }).data?.status === 'hard_deleted',
    ) as [{ data: { status: string; completedAt: unknown } }];
    expect(updateCall).toBeTruthy();
    expect(updateCall[0].data.completedAt).toBeInstanceOf(Date);
  });
});

// ─── handleJobFailure ─────────────────────────────────────────────────────────

describe('PrivacyDeletionService.handleJobFailure', () => {
  it('updates DeletionRequest.status=failed with failureReason', async () => {
    const { service, prisma } = makeDeletionService();

    await service.handleJobFailure(REQUEST_ID, 'timeout after 3 retries');

    expect(prisma.client.deletionRequest.update).toHaveBeenCalledWith({
      where: { id: REQUEST_ID },
      data: { status: 'failed', failureReason: 'timeout after 3 retries' },
    });
  });
});

// ─── PrivacyExportService: export guard during deletion_pending ───────────────

describe('PrivacyExportService.createJob — deletion_pending guard (dec-012/Q4)', () => {
  it('throws 409 when user.status=deletion_pending', async () => {
    const prisma = {
      client: {
        user: {
          findUnique: vi.fn().mockResolvedValue({ status: 'deletion_pending' }),
        },
        privacyExportJob: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        userTenant: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };

    const bullMqService = {
      createQueue: vi.fn().mockReturnValue({ add: vi.fn() }),
    };
    const redis = {};
    const storage = {};

    const service = new PrivacyExportService(
      bullMqService as never,
      prisma as never,
      redis as never,
      storage as never,
      {} as never, // usersService
      {} as never, // groupMembersService
      {} as never, // meetingsService
      {} as never, // progressService
      {} as never, // pastoralService
      {} as never, // consentService
      {} as never, // auditService
    );

    // Inject queue
    (service as unknown as { queue: unknown }).queue = { add: vi.fn() };

    await expect(service.createJob(USER_A_ID, 'json', TENANT_ID)).rejects.toThrow(
      ConflictException,
    );

    const error = await service.createJob(USER_A_ID, 'json', TENANT_ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toContain('deletion request is pending');
  });
});
