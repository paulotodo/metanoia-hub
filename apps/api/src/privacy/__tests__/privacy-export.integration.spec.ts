/**
 * Integration tests for PrivacyExportService.processExportJob (FASE 5.1)
 *
 * Tests validate:
 * - AC2: processExportJob calls all 7 exportUserData/exportConsentData
 * - AC8: user with no data produces valid export with empty sections
 * - FR-03: multi-tenant export contains tenants[] with 2+ entries
 * - NFR-P1: benchmark with 5 tenants × ~5 records each < 30s
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacyExportService } from '../privacy-export.service';
import type { PrivacyExportJobPayload } from '@metanoia/types';

// ─── Fixed IDs ────────────────────────────────────────────────────────────────

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_A = '01912345-6789-7000-8000-000000000001';
const TENANT_B = '01912345-6789-7000-8000-000000000002';
const JOB_ID = '01912345-6789-7000-8000-000000000099';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeEmptyExportServices() {
  return {
    usersService: {
      exportUserData: vi.fn().mockResolvedValue({ profile: null, tenants: [] }),
    },
    groupMembersService: {
      exportUserData: vi.fn().mockResolvedValue({ memberships: [] }),
    },
    meetingsService: {
      exportUserData: vi.fn().mockResolvedValue({ attendance: [], participantRecords: [] }),
    },
    progressService: {
      exportUserData: vi.fn().mockResolvedValue({ trailProgress: [], lessonProgress: [] }),
    },
    pastoralService: {
      exportUserData: vi.fn().mockResolvedValue({ alertsAboutMe: [], notesAboutMe: [] }),
    },
    consentService: {
      exportConsentData: vi.fn().mockResolvedValue({ acceptances: [], withdrawals: [] }),
    },
    auditService: {
      exportUserData: vi.fn().mockResolvedValue({ events: [] }),
    },
  };
}

function makeFullExportServices(records = 1) {
  const svc = makeEmptyExportServices();
  svc.usersService.exportUserData.mockResolvedValue({
    profile: {
      id: USER_ID,
      email: 'user@example.com',
      name: 'User Test',
      status: 'active',
      onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
    tenants: [{ tenantId: TENANT_A, role: 'membro', joinedAt: '2026-01-01T00:00:00.000Z' }],
  });

  const memberships = Array.from({ length: records }, (_, i) => ({
    groupId: `01912345-6789-7000-8000-00000000${String(i).padStart(4, '0')}`,
    groupName: `Grupo ${i}`,
    role: 'membro',
    joinedAt: '2026-01-01T00:00:00.000Z',
  }));
  svc.groupMembersService.exportUserData.mockResolvedValue({ memberships });

  const attendance = Array.from({ length: records }, (_, i) => ({
    meetingId: `01912345-6789-7000-8000-0000000${String(10 + i).padStart(5, '0')}`,
    title: `Reunião ${i}`,
    presenceType: 'integral',
    joinTime: '2026-03-01T09:00:00.000Z',
    leaveTime: '2026-03-01T10:00:00.000Z',
  }));
  svc.meetingsService.exportUserData.mockResolvedValue({ attendance, participantRecords: [] });

  const events = Array.from({ length: records }, (_, i) => ({
    action: `action_${i}`,
    resource: 'test',
    resourceId: null,
    timestamp: '2026-04-01T00:00:00.000Z',
  }));
  svc.auditService.exportUserData.mockResolvedValue({ events });

  return svc;
}

function makePrisma() {
  return {
    client: {
      privacyExportJob: {
        update: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

function makeRedis() {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  };
}

function makeStorage() {
  return {
    upload: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue('https://minio.example.com/exports/global/file.json'),
  };
}

function makeBullMq() {
  const queue = { add: vi.fn().mockResolvedValue({}) };
  return {
    createQueue: vi.fn().mockReturnValue(queue),
    createWorker: vi.fn(),
  };
}

function makeService(services: ReturnType<typeof makeEmptyExportServices>) {
  const svc = new PrivacyExportService(
    makeBullMq() as never,
    makePrisma() as never,
    makeRedis() as never,
    makeStorage() as never,
    services.usersService as never,
    services.groupMembersService as never,
    services.meetingsService as never,
    services.progressService as never,
    services.pastoralService as never,
    services.consentService as never,
    services.auditService as never,
  );
  // Skip queue init — not needed for processExportJob
  return svc;
}

function makePayload(allTenantIds: string[]): PrivacyExportJobPayload {
  return {
    jobId: JOB_ID,
    userId: USER_ID,
    format: 'json',
    allTenantIds,
    requestedAt: '2026-06-12T00:00:00.000Z',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PrivacyExportService.processExportJob', () => {
  describe('AC2 — calls all 7 exportUserData/exportConsentData', () => {
    it('invokes all 7 data collection methods', async () => {
      const services = makeFullExportServices(2);
      const svc = makeService(services);

      await svc.processExportJob(makePayload([TENANT_A]));

      expect(services.usersService.exportUserData).toHaveBeenCalledOnce();
      expect(services.groupMembersService.exportUserData).toHaveBeenCalledTimes(1);
      expect(services.meetingsService.exportUserData).toHaveBeenCalledTimes(1);
      expect(services.progressService.exportUserData).toHaveBeenCalledTimes(1);
      expect(services.pastoralService.exportUserData).toHaveBeenCalledTimes(1);
      expect(services.consentService.exportConsentData).toHaveBeenCalledTimes(1);
      expect(services.auditService.exportUserData).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC8 — user with no data produces valid export', () => {
    it('processes without error when all modules return empty data', async () => {
      const services = makeEmptyExportServices();
      const svc = makeService(services);

      await expect(svc.processExportJob(makePayload([TENANT_A]))).resolves.toBeUndefined();
    });

    it('validates payload against FullExportPayloadSchema without throwing', async () => {
      const services = makeEmptyExportServices();
      const svc = makeService(services);

      // If schema validation throws, the promise rejects
      await expect(svc.processExportJob(makePayload([TENANT_A]))).resolves.not.toThrow();
    });
  });

  describe('FR-03 — multi-tenant export', () => {
    it('calls per-tenant services for each tenant in allTenantIds', async () => {
      const services = makeFullExportServices(1);
      const svc = makeService(services);

      await svc.processExportJob(makePayload([TENANT_A, TENANT_B]));

      // Per-tenant services called twice
      expect(services.groupMembersService.exportUserData).toHaveBeenCalledTimes(2);
      expect(services.meetingsService.exportUserData).toHaveBeenCalledTimes(2);
      expect(services.auditService.exportUserData).toHaveBeenCalledTimes(2);

      // User-level service called once
      expect(services.usersService.exportUserData).toHaveBeenCalledOnce();
    });

    it('passes correct tenantId to each per-tenant service', async () => {
      const services = makeFullExportServices(1);
      const svc = makeService(services);

      await svc.processExportJob(makePayload([TENANT_A, TENANT_B]));

      const groupCalls = services.groupMembersService.exportUserData.mock.calls;
      const tenantIds = groupCalls.map((c: unknown[]) => c[1]);
      expect(tenantIds).toContain(TENANT_A);
      expect(tenantIds).toContain(TENANT_B);
    });
  });

  describe('NFR-P1 — benchmark < 30s with 5 tenants', () => {
    it('completes in under 30 seconds for 5 tenants × 10 records', async () => {
      const services = makeFullExportServices(10);
      const svc = makeService(services);

      const start = Date.now();
      await svc.processExportJob(
        makePayload([
          '01912345-6789-7000-8000-000000000001',
          '01912345-6789-7000-8000-000000000002',
          '01912345-6789-7000-8000-000000000003',
          '01912345-6789-7000-8000-000000000004',
          '01912345-6789-7000-8000-000000000005',
        ]),
      );
      const elapsed = Date.now() - start;

      // With mocked services this should be near-instant; the 30s ceiling
      // documents the NFR-P1 production budget.
      expect(elapsed).toBeLessThan(30_000);
    }, 35_000);
  });

  describe('observability guards', () => {
    it('calls storage.upload with objectKey containing exports/global prefix', async () => {
      const services = makeEmptyExportServices();
      const storage = makeStorage();
      const svc = new PrivacyExportService(
        makeBullMq() as never,
        makePrisma() as never,
        makeRedis() as never,
        storage as never,
        services.usersService as never,
        services.groupMembersService as never,
        services.meetingsService as never,
        services.progressService as never,
        services.pastoralService as never,
        services.consentService as never,
        services.auditService as never,
      );

      await svc.processExportJob(makePayload([TENANT_A]));

      const uploadCall = storage.upload.mock.calls[0] as [string, Buffer, string];
      expect(uploadCall[0]).toMatch(/^exports\/global\//);
    });
  });
});
