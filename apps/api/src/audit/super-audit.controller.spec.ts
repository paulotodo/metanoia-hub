/**
 * Integration tests for SuperAuditController (cross-tenant, Super Admin).
 *
 * Tests:
 *   - GET /api/v1/super-admin/audit-events?tenantId=X → 200
 *   - GET without tenantId → BadRequestException
 *   - POST /api/v1/super-admin/audit-events/exports → 202 + jobId
 *   - POST without tenantId → BadRequestException
 *   - GET /api/v1/super-admin/audit-events/exports/:jobId → 200 / 404
 *   - tenantId forwarded to service.listEvents (dec-015 cross-tenant pattern)
 *
 * Story 9-3 (LGPD — Immutable Audit Log) — FASE 2.6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SuperAuditController } from './super-audit.controller';
import { AuditService } from './audit.service';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { AuditEventsQuery, AuditExportRequest, AuditEventListResponse } from '@metanoia/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeListResponse(): AuditEventListResponse {
  return {
    data: [
      {
        id: 'evt-super-01',
        tenantId: 'tenant-B',
        userId: 'user-b-01',
        action: 'delete',
        resource: 'group',
        resourceId: 'group-b-01',
        ipAddress: '10.0.0.2',
        userAgent: 'vitest/super-test',
        previousState: null,
        newState: null,
        timestamp: '2026-06-11T12:00:00.000Z',
        severity: 'critical',
      },
    ],
    meta: { page: 1, perPage: 50, total: 1, totalPages: 1 },
  };
}

const superAdminUser = {
  userId: 'user-super-01',
  tenantId: 'system',
  roles: ['super_admin'] as string[],
  email: 'super@metanoia.app',
};

const defaultQuery: AuditEventsQuery = { page: 1, perPage: 50 };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SuperAuditController', () => {
  let controller: SuperAuditController;
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
      controllers: [SuperAuditController],
      providers: [{ provide: AuditService, useValue: service }],
    })
      .overrideGuard(KeycloakAuthGuard).useValue(passGuard)
      .overrideGuard(RolesGuard).useValue(passGuard)
      .compile();

    controller = module.get(SuperAuditController);
  });

  // ─── GET /api/v1/super-admin/audit-events ────────────────────────────────

  describe('GET /api/v1/super-admin/audit-events (listEvents)', () => {
    it('returns 200 with cross-tenant events when tenantId provided', async () => {
      service.listEvents.mockResolvedValue(makeListResponse());

      const result = await controller.listEvents(defaultQuery, 'tenant-B');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.tenantId).toBe('tenant-B');
    });

    it('forwards tenantId to service.listEvents as second arg (dec-015 cross-tenant)', async () => {
      service.listEvents.mockResolvedValue(makeListResponse());

      await controller.listEvents(defaultQuery, 'tenant-B');

      expect(service.listEvents).toHaveBeenCalledWith(defaultQuery, 'tenant-B');
    });

    it('throws BadRequestException when tenantId is missing', async () => {
      await expect(controller.listEvents(defaultQuery, undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(service.listEvents).not.toHaveBeenCalled();
    });

    it('forwards all query filters to service', async () => {
      service.listEvents.mockResolvedValue(makeListResponse());
      const query: AuditEventsQuery = {
        page: 1,
        perPage: 10,
        action: 'delete',
        severity: 'critical',
        userId: 'user-b-01',
      };

      await controller.listEvents(query, 'tenant-B');

      expect(service.listEvents).toHaveBeenCalledWith(query, 'tenant-B');
    });
  });

  // ─── POST /api/v1/super-admin/audit-events/exports ────────────────────────

  describe('POST /api/v1/super-admin/audit-events/exports (createExport)', () => {
    it('returns 202 with jobId when tenantId provided', async () => {
      service.createExportJob.mockResolvedValue({ jobId: 'job-super-01' });

      const result = await controller.createExport(
        {} as AuditExportRequest,
        'tenant-B',
        { user: superAdminUser },
      );

      expect(result.data.jobId).toBe('job-super-01');
    });

    it('forwards tenantId to createExportJob (not null)', async () => {
      service.createExportJob.mockResolvedValue({ jobId: 'job-super-02' });

      await controller.createExport({} as AuditExportRequest, 'tenant-B', { user: superAdminUser });

      expect(service.createExportJob).toHaveBeenCalledWith(
        expect.anything(),
        'tenant-B', // tenantId must be forwarded (cross-tenant)
        superAdminUser.userId,
      );
    });

    it('throws BadRequestException when tenantId is missing', async () => {
      await expect(
        controller.createExport({} as AuditExportRequest, undefined, { user: superAdminUser }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(service.createExportJob).not.toHaveBeenCalled();
    });
  });

  // ─── GET /api/v1/super-admin/audit-events/exports/:jobId ─────────────────

  describe('GET /api/v1/super-admin/audit-events/exports/:jobId (getExportStatus)', () => {
    it('returns 200 with completed job status', async () => {
      const jobStatus = {
        jobId: 'job-super-01',
        status: 'completed' as const,
        signedUrl: 'https://minio/exports/job-super-01.csv',
        expiresAt: '2026-06-12T12:00:00Z',
        failureReason: null,
      };
      service.getExportJobStatus.mockResolvedValue(jobStatus);

      const result = await controller.getExportStatus('job-super-01');

      expect(result).toEqual({ data: jobStatus });
    });

    it('propagates NotFoundException when job expired or not found', async () => {
      service.getExportJobStatus.mockRejectedValue(
        new NotFoundException('Export job not found'),
      );

      await expect(controller.getExportStatus('job-gone')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forwards jobId to service.getExportJobStatus', async () => {
      service.getExportJobStatus.mockResolvedValue({
        jobId: 'job-x',
        status: 'processing' as const,
        signedUrl: null,
        expiresAt: null,
        failureReason: null,
      });

      await controller.getExportStatus('job-x');

      expect(service.getExportJobStatus).toHaveBeenCalledWith('job-x');
    });
  });
});
