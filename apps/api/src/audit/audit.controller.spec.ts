/**
 * Integration tests for AuditController (admin-scoped, tenant-scoped).
 *
 * Tests:
 *   - GET /api/v1/audit-events → 200 + AuditEventListResponse shape
 *   - POST /api/v1/audit-events/exports → 202 + jobId
 *   - GET /api/v1/audit-events/exports/:jobId → 200 + AuditExportJobStatus
 *   - GET /api/v1/audit-events/exports/:jobId → 404 when not found
 *   - Query params forwarded to service (listEvents)
 *
 * Uses NestJS Test.createTestingModule (no HTTP server, direct controller call).
 *
 * Story 9-3 (LGPD — Immutable Audit Log) — FASE 2.5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import type { AuditEventsQuery, AuditExportRequest, AuditEventListResponse } from '@metanoia/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeListResponse(overrides: Partial<AuditEventListResponse> = {}): AuditEventListResponse {
  return {
    data: [
      {
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
        timestamp: '2026-06-11T10:00:00.000Z',
        severity: 'info',
      },
    ],
    meta: { page: 1, perPage: 50, total: 1, totalPages: 1 },
    ...overrides,
  };
}

const defaultQuery: AuditEventsQuery = { page: 1, perPage: 50 };

const adminUser = {
  userId: 'user-admin-01',
  tenantId: 'tenant-01',
  roles: ['admin_tenant'] as string[],
  email: 'admin@igreja.com',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuditController', () => {
  let controller: AuditController;
  let service: {
    listEvents: ReturnType<typeof vi.fn>;
    createExportJob: ReturnType<typeof vi.fn>;
    getExportJobStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      listEvents: vi.fn(),
      createExportJob: vi.fn(),
      getExportJobStatus: vi.fn(),
    };

    const passGuard = { canActivate: () => true };
    const module = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: service }],
    })
      .overrideGuard(KeycloakAuthGuard).useValue(passGuard)
      .overrideGuard(RolesGuard).useValue(passGuard)
      .overrideGuard(TenantGuard).useValue(passGuard)
      .compile();

    controller = module.get(AuditController);
  });

  // ─── GET /api/v1/audit-events ─────────────────────────────────────────────

  describe('GET /api/v1/audit-events (listEvents)', () => {
    it('returns 200 with AuditEventListResponse shape', async () => {
      const mockResult = makeListResponse();
      service.listEvents.mockResolvedValue(mockResult);

      const result = await controller.listEvents(defaultQuery);

      expect(result).toEqual(mockResult);
    });

    it('forwards query params to service.listEvents', async () => {
      service.listEvents.mockResolvedValue(makeListResponse({ data: [], meta: { page: 2, perPage: 10, total: 0, totalPages: 0 } }));
      const query: AuditEventsQuery = { page: 2, perPage: 10, action: 'delete', severity: 'critical' };

      await controller.listEvents(query);

      expect(service.listEvents).toHaveBeenCalledWith(query);
    });

    it('returns empty list when no events', async () => {
      service.listEvents.mockResolvedValue(makeListResponse({
        data: [],
        meta: { page: 1, perPage: 50, total: 0, totalPages: 0 },
      }));

      const result = await controller.listEvents(defaultQuery);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('wraps pagination meta correctly', async () => {
      service.listEvents.mockResolvedValue(makeListResponse({
        meta: { page: 3, perPage: 50, total: 200, totalPages: 4 },
      }));

      const result = await controller.listEvents({ page: 3, perPage: 50 });

      expect(result.meta).toMatchObject({ page: 3, perPage: 50, total: 200, totalPages: 4 });
    });
  });

  // ─── POST /api/v1/audit-events/exports ───────────────────────────────────

  describe('POST /api/v1/audit-events/exports (createExport)', () => {
    it('returns 202 with jobId', async () => {
      const jobId = 'job-abc-123';
      service.createExportJob.mockResolvedValue({ jobId });

      const query: AuditExportRequest = {};
      const result = await controller.createExport(query, { user: adminUser });

      expect(result).toMatchObject({ data: { jobId } });
    });

    it('calls createExportJob with null tenantId (tenant-scoped) and requestedBy', async () => {
      service.createExportJob.mockResolvedValue({ jobId: 'job-01' });

      await controller.createExport({}, { user: adminUser });

      expect(service.createExportJob).toHaveBeenCalledWith(
        {},
        null, // tenant-scoped: tenantId from AsyncLocalStorage
        adminUser.userId,
      );
    });

    it('response includes message for UX', async () => {
      service.createExportJob.mockResolvedValue({ jobId: 'job-01' });

      const result = await controller.createExport({}, { user: adminUser });

      expect(result.data.message).toBeTruthy();
      expect(typeof result.data.message).toBe('string');
    });
  });

  // ─── GET /api/v1/audit-events/exports/:jobId ─────────────────────────────

  describe('GET /api/v1/audit-events/exports/:jobId (getExportStatus)', () => {
    it('returns 200 with job status when found', async () => {
      const jobStatus = {
        jobId: 'job-01',
        status: 'completed' as const,
        signedUrl: 'https://minio/exports/job-01.csv',
        expiresAt: '2026-06-12T10:00:00Z',
        failureReason: null,
      };
      service.getExportJobStatus.mockResolvedValue(jobStatus);

      const result = await controller.getExportStatus('job-01');

      expect(result).toEqual({ data: jobStatus });
    });

    it('returns processing status while job is pending', async () => {
      const jobStatus = {
        jobId: 'job-02',
        status: 'processing' as const,
        signedUrl: null,
        expiresAt: null,
        failureReason: null,
      };
      service.getExportJobStatus.mockResolvedValue(jobStatus);

      const result = await controller.getExportStatus('job-02');

      expect(result.data.status).toBe('processing');
      expect(result.data.signedUrl).toBeNull();
    });

    it('propagates NotFoundException from service (404)', async () => {
      service.getExportJobStatus.mockRejectedValue(
        new NotFoundException('Export job job-missing not found or expired'),
      );

      await expect(controller.getExportStatus('job-missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('forwards jobId param to service.getExportJobStatus', async () => {
      service.getExportJobStatus.mockResolvedValue({
        jobId: 'job-xyz',
        status: 'processing' as const,
        signedUrl: null,
        expiresAt: null,
        failureReason: null,
      });

      await controller.getExportStatus('job-xyz');

      expect(service.getExportJobStatus).toHaveBeenCalledWith('job-xyz');
    });
  });
});
