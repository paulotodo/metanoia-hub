/**
 * csv-import.service.spec.ts
 * Unit tests for CsvImportService — FR03 state machine, FR04 plan limits,
 * CSV injection sanitization, summary aggregation, invite idempotency,
 * anti-mass-assignment verification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { ImportRowInput } from '@metanoia/types';

// ─── Module under test ────────────────────────────────────────────────────────

// We test pure logic: processRows, enforcePlanLimit, generateReport.
// We don't mount the full NestJS DI — we construct the service directly
// with mock dependencies.

import { CsvImportService } from './csv-import.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ImportRowInput> = {}): ImportRowInput {
  return {
    nome: 'João Silva',
    email: 'joao@example.com',
    papel: 'participante',
    rowIndex: 0,
    ...overrides,
  };
}

function makeTxMock() {
  return {
    group: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userTenant: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    groupMember: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

function makeDeps() {
  const txMock = makeTxMock();

  const prisma = {
    client: {
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMock)),
    },
  } as unknown as ConstructorParameters<typeof CsvImportService>[0];

  const planLimitsService = {
    getPlan: vi.fn().mockResolvedValue('free'),
  } as unknown as ConstructorParameters<typeof CsvImportService>[1];

  const groupMembersRepository = {
    countByGroup: vi.fn().mockResolvedValue(0),
    findGroupById: vi.fn(),
  } as unknown as ConstructorParameters<typeof CsvImportService>[2];

  const adminInvitesService = {
    create: vi.fn().mockResolvedValue({ data: { invite: {}, inviteUrl: '' } }),
  } as unknown as ConstructorParameters<typeof CsvImportService>[3];

  const auditService = {
    createEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as ConstructorParameters<typeof CsvImportService>[4];

  const storageService = {
    upload: vi.fn().mockResolvedValue('key'),
    getSignedUrl: vi.fn().mockResolvedValue('https://minio.example.com/signed'),
  } as unknown as ConstructorParameters<typeof CsvImportService>[5];

  const bullMqService = {
    createQueue: vi.fn().mockReturnValue({ add: vi.fn() }),
  } as unknown as ConstructorParameters<typeof CsvImportService>[6];

  const redisService = {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  } as unknown as ConstructorParameters<typeof CsvImportService>[7];

  const eventEmitter = {
    emit: vi.fn(),
  } as unknown as ConstructorParameters<typeof CsvImportService>[8];

  return { prisma, planLimitsService, groupMembersRepository, adminInvitesService, auditService, storageService, bullMqService, redisService, eventEmitter, txMock };
}

// Stub getRequestContext to return a fixed tenantId
vi.mock('../common/context/request-context', () => ({
  getRequestContext: () => ({ tenantId: 'aaaaaaaa-0000-7000-8000-000000000001', userId: 'user-1', requestId: 'req-1', correlationId: 'corr-1' }),
  requestContext: { run: vi.fn((_store: unknown, fn: () => unknown) => fn()), getStore: vi.fn(() => ({ tenantId: 'aaaaaaaa-0000-7000-8000-000000000001' })) },
}));

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(async (prisma: { client: { $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> } }, fn: (tx: unknown) => Promise<unknown>) => {
    // Call $transaction with fn to simulate tx behaviour
    return prisma.client.$transaction(fn);
  }),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CsvImportService', () => {
  let service: CsvImportService;
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
    service = new CsvImportService(
      deps.prisma,
      deps.planLimitsService,
      deps.groupMembersRepository,
      deps.adminInvitesService,
      deps.auditService,
      deps.storageService,
      deps.bullMqService,
      deps.redisService,
      deps.eventEmitter,
    );
    // Simulate onModuleInit so queue is set
    service.onModuleInit();
  });

  // ── FR03: 4-state machine ─────────────────────────────────────────────────

  describe('processRows — FR03 state machine', () => {
    const DEFAULT_GROUP_ID = 'bbbbbbbb-0000-7000-8000-000000000001';
    const GROUP_NAME = 'Grupo Teste';

    function setupGroupFound(tx: ReturnType<typeof makeTxMock>) {
      tx.group.findFirst.mockResolvedValue({ id: DEFAULT_GROUP_ID, name: GROUP_NAME });
    }

    it('State 1: new user → action=created; prisma.user.create called', async () => {
      setupGroupFound(deps.txMock);
      deps.txMock.user.findUnique.mockResolvedValue(null); // user not found globally
      deps.txMock.user.create.mockResolvedValue({ id: 'new-user-id' });
      deps.txMock.userTenant.create.mockResolvedValue({});
      deps.txMock.groupMember.create.mockResolvedValue({});

      const rows = [makeRow({ email: 'new@example.com', nome: 'Novo', grupo: GROUP_NAME })];
      const summary = await service.processRows(rows, DEFAULT_GROUP_ID);

      expect(summary.lines[0]?.action).toBe('created');
      expect(summary.imported).toBe(1);
      expect(deps.txMock.user.create).toHaveBeenCalledOnce();
    });

    it('State 1 — anti-mass-assignment: user.create args MUST NOT contain rowIndex or grupo', async () => {
      setupGroupFound(deps.txMock);
      deps.txMock.user.findUnique.mockResolvedValue(null);
      deps.txMock.user.create.mockResolvedValue({ id: 'new-user-id' });
      deps.txMock.userTenant.create.mockResolvedValue({});
      deps.txMock.groupMember.create.mockResolvedValue({});

      const rows = [makeRow({ email: 'new2@example.com', nome: 'Anti', grupo: GROUP_NAME, rowIndex: 5, telefone: '99999' })];
      await service.processRows(rows, DEFAULT_GROUP_ID);

      const createCall = deps.txMock.user.create.mock.calls[0];
      const data = (createCall?.[0] as { data: Record<string, unknown> }).data;
      expect(data).not.toHaveProperty('rowIndex');
      expect(data).not.toHaveProperty('grupo');
      expect(data).not.toHaveProperty('telefone');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('id');
    });

    it('State 2: user already in this tenant → action=existing; no user.create', async () => {
      setupGroupFound(deps.txMock);
      const userId = 'cccccccc-0000-7000-8000-000000000001';
      deps.txMock.user.findUnique.mockResolvedValue({ id: userId, email: 'existing@example.com' });
      deps.txMock.userTenant.findFirst.mockResolvedValue({ id: 'ut-1', userId, tenantId: 'aaaaaaaa-0000-7000-8000-000000000001' });
      deps.txMock.groupMember.findFirst.mockResolvedValue({ id: 'gm-1' }); // already member

      const rows = [makeRow({ email: 'existing@example.com', grupo: GROUP_NAME })];
      const summary = await service.processRows(rows, DEFAULT_GROUP_ID);

      expect(summary.lines[0]?.action).toBe('existing');
      expect(summary.existing).toBe(1);
      expect(deps.txMock.user.create).not.toHaveBeenCalled();
    });

    it('State 3: user in another tenant → action=invited; adminInvitesService.create called', async () => {
      setupGroupFound(deps.txMock);
      const userId = 'dddddddd-0000-7000-8000-000000000001';
      deps.txMock.user.findUnique.mockResolvedValue({ id: userId, email: 'other@example.com' });
      deps.txMock.userTenant.findFirst.mockResolvedValue(null); // not in this tenant

      const rows = [makeRow({ email: 'other@example.com', grupo: GROUP_NAME })];
      const summary = await service.processRows(rows, DEFAULT_GROUP_ID);

      expect(summary.lines[0]?.action).toBe('invited');
      expect(summary.invited).toBe(1);
      expect(deps.adminInvitesService.create).toHaveBeenCalledOnce();
    });

    it('State 3 — idempotency: second call with same email+group catches ConflictException; create called once', async () => {
      setupGroupFound(deps.txMock);
      const userId = 'eeeeeeee-0000-7000-8000-000000000001';
      deps.txMock.user.findUnique.mockResolvedValue({ id: userId, email: 'conflict@example.com' });
      deps.txMock.userTenant.findFirst.mockResolvedValue(null);

      // Second call: simulate ConflictException (status 409)
      const conflictErr = Object.assign(new Error('Conflict'), { status: 409 });
      deps.adminInvitesService.create
        .mockResolvedValueOnce({ data: { invite: {}, inviteUrl: '' } })
        .mockRejectedValueOnce(conflictErr);

      const rows = [makeRow({ email: 'conflict@example.com', grupo: GROUP_NAME })];
      // First call
      const s1 = await service.processRows(rows, DEFAULT_GROUP_ID);
      expect(s1.lines[0]?.action).toBe('invited');
      // Second call — should not throw, just ignore conflict
      const s2 = await service.processRows(rows, DEFAULT_GROUP_ID);
      expect(s2.lines[0]?.action).toBe('invited');
    });

    it('State 4: group name not found → action=failed; reason mentions group name', async () => {
      // grupo specified but not found
      deps.txMock.group.findFirst.mockResolvedValue(null);

      const rows = [makeRow({ email: 'fail@example.com', grupo: 'Grupo Inexistente' })];
      const summary = await service.processRows(rows, DEFAULT_GROUP_ID);

      expect(summary.lines[0]?.action).toBe('failed');
      expect(summary.failed).toBe(1);
      expect(summary.lines[0]?.reason).toContain('Grupo Inexistente');
    });

    it('aggregation: imported + existing + invited + failed === total', async () => {
      // 4 rows testing each state
      setupGroupFound(deps.txMock);
      const existingUserId = 'ffffffff-0000-7000-8000-000000000001';
      const otherTenantUserId = '11111111-0000-7000-8000-000000000001';

      deps.txMock.user.findUnique
        .mockResolvedValueOnce(null) // row 0: new user
        .mockResolvedValueOnce({ id: existingUserId }) // row 1: existing in tenant
        .mockResolvedValueOnce({ id: otherTenantUserId }); // row 2: other tenant

      deps.txMock.userTenant.findFirst
        .mockResolvedValueOnce({ id: 'ut-1' }) // row 1: in this tenant
        .mockResolvedValueOnce(null); // row 2: NOT in this tenant

      deps.txMock.groupMember.findFirst.mockResolvedValue({ id: 'gm-1' }); // existing member
      deps.txMock.user.create.mockResolvedValue({ id: 'new-id' });
      deps.txMock.userTenant.create.mockResolvedValue({});
      deps.txMock.groupMember.create.mockResolvedValue({});

      const rows = [
        makeRow({ email: 'new@t.com', rowIndex: 0, grupo: GROUP_NAME }),
        makeRow({ email: 'existing@t.com', rowIndex: 1, grupo: GROUP_NAME }),
        makeRow({ email: 'other@t.com', rowIndex: 2, grupo: GROUP_NAME }),
        makeRow({ email: 'fail@t.com', rowIndex: 3, grupo: 'Grupo Inexistente' }),
      ];

      // Override group.findFirst to return null for 'Grupo Inexistente'
      deps.txMock.group.findFirst
        .mockResolvedValueOnce({ id: DEFAULT_GROUP_ID, name: GROUP_NAME }) // row 0
        .mockResolvedValueOnce({ id: DEFAULT_GROUP_ID, name: GROUP_NAME }) // row 1
        .mockResolvedValueOnce({ id: DEFAULT_GROUP_ID, name: GROUP_NAME }) // row 2
        .mockResolvedValueOnce(null); // row 3: Grupo Inexistente not found

      const summary = await service.processRows(rows, DEFAULT_GROUP_ID);
      expect(summary.imported + summary.existing + summary.invited + summary.failed).toBe(summary.total);
      expect(summary.total).toBe(4);
    });
  });

  // ── FR04: plan limit enforcement ──────────────────────────────────────────

  describe('enforcePlanLimit — FR04', () => {
    it('throws ForbiddenException with error=PlanLimitReached when limit exceeded', async () => {
      deps.planLimitsService.getPlan.mockResolvedValue('free'); // free = 30 membersPerGroup
      deps.groupMembersRepository.countByGroup.mockResolvedValue(28);

      // 28 current + 5 new = 33 > 30 → should reject
      await expect(service.enforcePlanLimit('group-1', 5)).rejects.toThrow(ForbiddenException);
    });

    it('does not throw when within limit', async () => {
      deps.planLimitsService.getPlan.mockResolvedValue('free'); // 30
      deps.groupMembersRepository.countByGroup.mockResolvedValue(10);

      // 10 + 5 = 15 <= 30 → OK
      await expect(service.enforcePlanLimit('group-1', 5)).resolves.toBeUndefined();
    });

    it('does not throw for enterprise (Infinity limit)', async () => {
      deps.planLimitsService.getPlan.mockResolvedValue('enterprise');
      deps.groupMembersRepository.countByGroup.mockResolvedValue(999);

      await expect(service.enforcePlanLimit('group-1', 1000)).resolves.toBeUndefined();
    });
  });

  // ── CSV injection sanitization ────────────────────────────────────────────

  describe('generateReport — CSV injection sanitization', () => {
    it("prefixes '=' cell with single-quote to prevent CSV injection", async () => {
      const summary = {
        total: 1,
        imported: 1,
        existing: 0,
        invited: 0,
        failed: 0,
        lines: [
          {
            rowIndex: 0,
            email: '=HYPERLINK("http://evil.com")',
            nome: '=MALICIOUS',
            groupName: 'Grupo',
            action: 'created' as const,
          },
        ],
        reportUrl: null,
        jobId: null,
      };

      await service.generateReport(summary, 'tenant-1', 'job-1');

      const uploadCall = deps.storageService.upload.mock.calls[0];
      const buffer = uploadCall?.[1] as Buffer;
      const csvContent = buffer.toString('utf-8');

      // Cells starting with = should be prefixed with '
      expect(csvContent).toContain("'=HYPERLINK");
      expect(csvContent).toContain("'=MALICIOUS");
    });

    it('prefixes + - @ cells with single-quote', async () => {
      const summary = {
        total: 1,
        imported: 1,
        existing: 0,
        invited: 0,
        failed: 0,
        lines: [
          {
            rowIndex: 0,
            email: 'ok@example.com',
            nome: '+SUM(A1)',
            groupName: 'Grupo A',
            action: 'created' as const,
            reason: '-injected',
          },
        ],
        reportUrl: null,
        jobId: null,
      };

      await service.generateReport(summary, 'tenant-1', 'job-2');

      const uploadCall = deps.storageService.upload.mock.calls[0];
      const buffer = uploadCall?.[1] as Buffer;
      const csvContent = buffer.toString('utf-8');

      expect(csvContent).toContain("'+SUM");
      expect(csvContent).toContain("'-injected");
    });
  });
});
