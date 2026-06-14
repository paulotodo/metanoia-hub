/**
 * csv-import.integration-spec.ts
 * Integration-style tests for CsvImportController and CsvImportJobController.
 *
 * Uses NestJS Test.createTestingModule (no real DB/Redis — all deps mocked).
 * Each test exercises the controller method directly, verifying the full
 * pipeline: plan limit → processRows → 201/202/403/400/404.
 *
 * Covered (FASE 5.3 + 5.4):
 *   SYNC: POST ≤100 rows → 201 + ImportResultSummary (jobId: null)
 *   ASYNC: POST >100 rows → 202 + { jobId }
 *   Polling: GET /import/jobs/:jobId → 200 + ImportJobStatus
 *   IDOR: GET jobId of tenant A with tenant B credential → 404
 *   PlanLimit: POST exceeding limit → 403 { error: 'PlanLimitReached' }
 *   Zod rows:[]: POST with empty rows → 400 (ZodValidationPipe rejects)
 *   Job not found: GET unknown jobId → 404
 *   Audit/Event (FASE 5.4): AuditService.createEvent called with action:'import'
 *     + EventEmitter2.emit called with correct shape
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { uuidv7 } from 'uuidv7';
import type {
  ImportRequest,
  ImportResultSummary,
  ImportJobStatus,
} from '@metanoia/types';
import {
  IMPORT_SYNC_THRESHOLD,
  ImportJobStatusSchema,
} from '@metanoia/types';
import { CsvImportController, CsvImportJobController } from './csv-import.controller';
import { CsvImportService } from './csv-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { CsvImportRateLimitGuard } from './csv-import-rate-limit.guard';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ImportRequestSchema } from '@metanoia/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_A_ID = '01989abc-0001-7000-8000-000000000001';
const TENANT_B_ID = '01989abc-0002-7000-8000-000000000002';
const GROUP_ID = '01989abc-1111-7000-8000-000000000011';
const USER_ID = '01989abc-aaaa-7000-8000-0000000000a1';

// ─── Mock withTenantTx ────────────────────────────────────────────────────────
// Controller calls requireGroupInTenant → withTenantTx. Mock it to run fn()
// directly without a real DB transaction, returning a group stub.

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(async (_prisma: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      group: { findFirst: vi.fn().mockResolvedValue({ id: GROUP_ID, tenantId: TENANT_A_ID }) },
    }),
  ),
}));

// ─── Mock RequestContext ──────────────────────────────────────────────────────

let currentTenantId = TENANT_A_ID;

vi.mock('../common/context/request-context', () => ({
  getRequestContext: () => ({
    tenantId: currentTenantId,
    userId: USER_ID,
    roles: ['admin_tenant'],
  }),
  requestContext: { getStore: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(idx: number = 0) {
  return {
    nome: `Participante ${idx}`,
    email: `participante${idx}@test.local`,
    papel: 'participante' as const,
    rowIndex: idx,
  };
}

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => makeRow(i));
}

function makeSyncSummary(partial: Partial<ImportResultSummary> = {}): ImportResultSummary {
  return {
    total: 1,
    imported: 1,
    existing: 0,
    invited: 0,
    failed: 0,
    lines: [
      {
        rowIndex: 0,
        email: 'participante0@test.local',
        nome: 'Participante 0',
        groupName: 'Grupo Teste',
        action: 'created',
      },
    ],
    reportUrl: 'https://storage.example.com/report.csv',
    jobId: null,
    ...partial,
  };
}

function makeJobStatus(
  jobId: string,
  tenantId: string,
  status: 'processing' | 'completed' | 'failed' = 'processing',
): ImportJobStatus & { tenantId: string } {
  return {
    jobId,
    tenantId,
    status,
    progress: status === 'completed' ? 100 : 50,
    result: status === 'completed' ? makeSyncSummary({ jobId }) : null,
    failureReason: null,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

function makeServiceMock() {
  return {
    enforcePlanLimit: vi.fn().mockResolvedValue(undefined),
    processRows: vi.fn().mockImplementation(() => Promise.resolve(makeSyncSummary())),
    generateReport: vi.fn().mockImplementation((_s: ImportResultSummary) => {
      _s.reportUrl = 'https://storage.example.com/report.csv';
      return Promise.resolve('https://storage.example.com/report.csv');
    }),
    emitAuditAndEvent: vi.fn().mockResolvedValue(undefined),
    setJobStatus: vi.fn().mockResolvedValue(undefined),
    getJobStatus: vi.fn().mockResolvedValue(makeJobStatus(uuidv7(), TENANT_A_ID)),
    getQueue: vi.fn().mockReturnValue({ add: vi.fn().mockResolvedValue(undefined) }),
    onModuleInit: vi.fn(),
  };
}

function makePrismaMock() {
  return {
    client: {
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          group: { findFirst: vi.fn().mockResolvedValue({ id: GROUP_ID }) },
        }),
      ),
    },
  };
}

function makeAuditMock() {
  return { createEvent: vi.fn().mockResolvedValue(undefined) };
}

function makeEventEmitterMock() {
  return { emit: vi.fn() };
}

const passGuard = { canActivate: () => true };

// ─── Suites ───────────────────────────────────────────────────────────────────

describe('CsvImportController', () => {
  let controller: CsvImportController;
  let serviceMock: ReturnType<typeof makeServiceMock>;
  let _auditMock: ReturnType<typeof makeAuditMock>;
  let _emitterMock: ReturnType<typeof makeEventEmitterMock>;

  // Minimal mock request + response objects for controller.importMembers
  function makeReqRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
    } as unknown as import('express').Response;
    const req = {
      headers: { 'user-agent': 'vitest', 'x-forwarded-for': '' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as import('express').Request;
    return { req, res };
  }

  const mockUser = {
    userId: USER_ID,
    tenantId: TENANT_A_ID,
    roles: ['admin_tenant'],
    email: 'admin@test.local',
  };

  beforeEach(async () => {
    currentTenantId = TENANT_A_ID;
    serviceMock = makeServiceMock();
    _auditMock = makeAuditMock();
    _emitterMock = makeEventEmitterMock();

    const module = await Test.createTestingModule({
      controllers: [CsvImportController],
      providers: [
        { provide: CsvImportService, useValue: serviceMock },
        { provide: CsvImportRateLimitGuard, useValue: passGuard },
        // PrismaService needed by controller's requireGroupInTenant
        {
          provide: PrismaService,
          useValue: {
            client: {
              $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
                fn({
                  group: {
                    findFirst: vi.fn().mockResolvedValue({ id: GROUP_ID }),
                  },
                }),
              ),
            },
          },
        },
      ],
    })
      .overrideGuard(KeycloakAuthGuard).useValue(passGuard)
      .overrideGuard(RolesGuard).useValue(passGuard)
      .overrideGuard(CsvImportRateLimitGuard).useValue(passGuard)
      .compile();

    controller = module.get(CsvImportController);
    // Patch prisma directly since it gets the mocked PrismaService
    Object.assign(controller, {
      prisma: {
        client: {
          $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn({
              group: { findFirst: vi.fn().mockResolvedValue({ id: GROUP_ID }) },
            }),
          ),
        },
      },
    });
  });

  // ── SYNC: ≤100 rows → 201 ──────────────────────────────────────────────────

  describe('SYNC: POST with ≤100 rows', () => {
    it('returns 201 with ImportResultSummary and jobId: null', async () => {
      const syncSummary = makeSyncSummary({ jobId: null });
      serviceMock.processRows.mockResolvedValue(syncSummary);

      const body: ImportRequest = {
        defaultGroupId: GROUP_ID,
        rows: makeRows(1),
      };
      const { req, res } = makeReqRes();

      const result = await controller.importMembers(
        GROUP_ID,
        body,
        mockUser as never,
        req,
        res,
      );

      // 201 status set
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      // Shape: { data: ImportResultSummary }
      expect(result).toHaveProperty('data');
      const data = (result as { data: ImportResultSummary }).data;
      expect(data.total).toBeGreaterThanOrEqual(1);
      // processRows called
      expect(serviceMock.processRows).toHaveBeenCalledWith(body.rows, GROUP_ID);
    });

    it('calls generateReport after processRows', async () => {
      const { req, res } = makeReqRes();
      await controller.importMembers(
        GROUP_ID,
        { defaultGroupId: GROUP_ID, rows: makeRows(1) },
        mockUser as never,
        req,
        res,
      );

      expect(serviceMock.generateReport).toHaveBeenCalledTimes(1);
    });

    it('calls emitAuditAndEvent after generateReport (FASE 5.4)', async () => {
      const { req, res } = makeReqRes();
      await controller.importMembers(
        GROUP_ID,
        { defaultGroupId: GROUP_ID, rows: makeRows(1) },
        mockUser as never,
        req,
        res,
      );

      expect(serviceMock.emitAuditAndEvent).toHaveBeenCalledTimes(1);
      const [calledUserId, calledGroupId] = serviceMock.emitAuditAndEvent.mock.calls[0] as [string, string];
      expect(calledUserId).toBe(USER_ID);
      expect(calledGroupId).toBe(GROUP_ID);
    });
  });

  // ── ASYNC: >100 rows → 202 ────────────────────────────────────────────────

  describe('ASYNC: POST with >100 rows', () => {
    it('returns 202 with jobId and message', async () => {
      const { req, res } = makeReqRes();
      const body: ImportRequest = {
        defaultGroupId: GROUP_ID,
        rows: makeRows(IMPORT_SYNC_THRESHOLD + 1),
      };

      const result = await controller.importMembers(
        GROUP_ID,
        body,
        mockUser as never,
        req,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
      expect(result).toHaveProperty('data');
      const data = (result as { data: { jobId: string; message: string } }).data;
      expect(typeof data.jobId).toBe('string');
      expect(data.jobId.length).toBeGreaterThan(0);
      expect(data.message).toContain('jobId');
    });

    it('calls setJobStatus with processing state', async () => {
      const { req, res } = makeReqRes();
      await controller.importMembers(
        GROUP_ID,
        { defaultGroupId: GROUP_ID, rows: makeRows(IMPORT_SYNC_THRESHOLD + 1) },
        mockUser as never,
        req,
        res,
      );

      expect(serviceMock.setJobStatus).toHaveBeenCalledWith(
        expect.any(String),
        TENANT_A_ID,
        expect.objectContaining({ status: 'processing', progress: 0 }),
      );
    });

    it('enqueues a BullMQ job with tenantId in payload', async () => {
      const addMock = vi.fn().mockResolvedValue(undefined);
      serviceMock.getQueue.mockReturnValue({ add: addMock });

      const { req, res } = makeReqRes();
      await controller.importMembers(
        GROUP_ID,
        { defaultGroupId: GROUP_ID, rows: makeRows(IMPORT_SYNC_THRESHOLD + 1) },
        mockUser as never,
        req,
        res,
      );

      expect(addMock).toHaveBeenCalledWith(
        'process-csv-import',
        expect.objectContaining({ tenantId: TENANT_A_ID, groupId: GROUP_ID }),
        expect.any(Object),
      );
    });
  });

  // ── Plan limit → 403 ──────────────────────────────────────────────────────

  describe('PlanLimit', () => {
    it('throws ForbiddenException with error: PlanLimitReached when limit exceeded', async () => {
      serviceMock.enforcePlanLimit.mockRejectedValue(
        new ForbiddenException({
          statusCode: 403,
          error: 'PlanLimitReached',
          message: 'Limite do plano atingido.',
          details: { resource: 'membersPerGroup', plan: 'free', current: 50, limit: 50 },
        }),
      );

      const { req, res } = makeReqRes();

      await expect(
        controller.importMembers(
          GROUP_ID,
          { defaultGroupId: GROUP_ID, rows: makeRows(5) },
          mockUser as never,
          req,
          res,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── Zod rows:[] → 400 ─────────────────────────────────────────────────────

  describe('Zod validation', () => {
    it('ZodValidationPipe rejects empty rows array with BadRequestException', () => {
      const pipe = new ZodValidationPipe(ImportRequestSchema);

      expect(() =>
        pipe.transform({ defaultGroupId: GROUP_ID, rows: [] } as never, {
          type: 'body',
        }),
      ).toThrow(BadRequestException);
    });
  });
});

// ─── CsvImportJobController ────────────────────────────────────────────────────

describe('CsvImportJobController', () => {
  let jobController: CsvImportJobController;
  let serviceMock: ReturnType<typeof makeServiceMock>;

  beforeEach(async () => {
    currentTenantId = TENANT_A_ID;
    serviceMock = makeServiceMock();

    const module = await Test.createTestingModule({
      controllers: [CsvImportJobController],
      providers: [{ provide: CsvImportService, useValue: serviceMock }],
    })
      .overrideGuard(KeycloakAuthGuard).useValue(passGuard)
      .overrideGuard(RolesGuard).useValue(passGuard)
      .compile();

    jobController = module.get(CsvImportJobController);
  });

  // ── Polling: GET → 200 ───────────────────────────────────────────────────

  it('returns 200 + ImportJobStatus for known jobId', async () => {
    const jobId = uuidv7();
    const status = makeJobStatus(jobId, TENANT_A_ID, 'processing');
    serviceMock.getJobStatus.mockResolvedValue(status);

    const result = await jobController.getJobStatus(jobId);

    expect(result).toHaveProperty('data');
    const parsed = ImportJobStatusSchema.safeParse(result.data);
    expect(parsed.success).toBe(true);
    expect(result.data.jobId).toBe(jobId);
  });

  // ── IDOR → 404 ───────────────────────────────────────────────────────────

  it('IDOR: GET with jobId from Tenant A using Tenant B context → 404', async () => {
    const jobId = uuidv7();
    // Job belongs to Tenant A
    const statusTenantA = makeJobStatus(jobId, TENANT_A_ID, 'processing');
    serviceMock.getJobStatus.mockResolvedValue(statusTenantA);

    // Switch context to Tenant B
    currentTenantId = TENANT_B_ID;

    await expect(jobController.getJobStatus(jobId)).rejects.toThrow(NotFoundException);
  });

  // ── Job not found → 404 ──────────────────────────────────────────────────

  it('throws NotFoundException for unknown jobId', async () => {
    serviceMock.getJobStatus.mockRejectedValue(new NotFoundException('Job not found'));

    await expect(jobController.getJobStatus(uuidv7())).rejects.toThrow(NotFoundException);
  });
});

// ─── FASE 5.4 — Audit + Event emission ────────────────────────────────────────

describe('CsvImportService — audit and domain event (FASE 5.4)', () => {
  it('emitAuditAndEvent calls AuditService.createEvent with action:import and resource:group', async () => {
    const auditMock = makeAuditMock();
    const emitterMock = makeEventEmitterMock();
    const redisMock = { get: vi.fn(), setex: vi.fn() };
    const prismaMock = makePrismaMock();

    // Construct service directly (no DI — unit-level wiring for FASE 5.4 coverage)
    const service = new CsvImportService(
      prismaMock as never,
      { getPlan: vi.fn().mockResolvedValue('free') } as never,
      { countByGroup: vi.fn().mockResolvedValue(0) } as never,
      { create: vi.fn() } as never,
      auditMock as never,
      { upload: vi.fn(), getSignedUrl: vi.fn().mockResolvedValue('https://url') } as never,
      { createQueue: vi.fn().mockReturnValue({ add: vi.fn() }) } as never,
      redisMock as never,
      emitterMock as unknown as EventEmitter2,
    );

    // getRequestContext() is already mocked at module level to return TENANT_A_ID.
    // Call the service directly — no ALS wrapping needed.
    const summary = makeSyncSummary();
    await service.emitAuditAndEvent(USER_ID, GROUP_ID, summary, '127.0.0.1', 'vitest');

    // AuditService.createEvent called with correct args
    expect(auditMock.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        action: 'import',
        resource: 'group',
        resourceId: GROUP_ID,
      }),
    );

    // EventEmitter2.emit called with correct event type + shape
    expect(emitterMock.emit).toHaveBeenCalledWith(
      'onboarding.csv_import.completed',
      expect.objectContaining({
        eventType: 'onboarding.csv_import.completed',
        version: 1,
        tenantId: TENANT_A_ID,
        data: expect.objectContaining({
          groupId: GROUP_ID,
          total: expect.any(Number),
        }),
      }),
    );
  });
});
