/**
 * Unit tests for OnboardingController — FASE 3 (dados-demonstracao, Story 10-2).
 *
 * Tests:
 *   - DELETE /api/v1/onboarding/demo-data → 204, calls deleteDemoData with tenantId from context
 *   - GET /api/v1/onboarding/demo-status → 200, wraps result in { data }
 *   - PATCH /api/v1/onboarding/demo-nudge-dismiss → 204, calls dismissNudge with tenantId
 *   - Tenant scope: each method reads tenantId from RequestContext (ALS), not params
 *   - Transactional: deleteDemoData is tested via the DemoDataService mock
 *
 * Uses NestJS Test.createTestingModule — no HTTP server, direct controller call.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { OnboardingController } from './onboarding.controller';
import { DemoDataService } from './demo-data.service';
import { OnboardingWizardService } from './onboarding-wizard.service';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';

// Prevent demo-data.seed.ts CLI main() from calling process.exit during import
vi.mock('./seed/demo-data.seed', () => ({
  seedDemoData: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock RequestContext ──────────────────────────────────────────────────────

const mockTenantId = '01989b10-cafe-7000-8000-000000000001';

vi.mock('../common/context/request-context', () => ({
  getRequestContext: () => ({ tenantId: mockTenantId, userId: 'user-01', roles: ['admin_tenant'] }),
  requestContext: { getStore: vi.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeDemoStatus = () => ({
  hasDemoData: true,
  hasRealData: false,
  demoRecordCount: 35,
  nudgeDismissed: false,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let service: {
    deleteDemoData: ReturnType<typeof vi.fn>;
    getDemoStatus: ReturnType<typeof vi.fn>;
    dismissNudge: ReturnType<typeof vi.fn>;
    seedDemoData: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      deleteDemoData: vi.fn().mockResolvedValue(undefined),
      getDemoStatus: vi.fn().mockResolvedValue(makeDemoStatus()),
      dismissNudge: vi.fn().mockResolvedValue(undefined),
      seedDemoData: vi.fn().mockResolvedValue(undefined),
    };

    const mockWizardService = { getWizardStatus: vi.fn().mockResolvedValue({ data: { progress: {}, hasRealGroups: false } }) };

    const passGuard = { canActivate: () => true };
    const module = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        { provide: DemoDataService, useValue: service },
        { provide: OnboardingWizardService, useValue: mockWizardService },
      ],
    })
      .overrideGuard(KeycloakAuthGuard).useValue(passGuard)
      .overrideGuard(RolesGuard).useValue(passGuard)
      .compile();

    controller = module.get(OnboardingController);
  });

  // ─── DELETE /api/v1/onboarding/demo-data ─────────────────────────────────

  describe('DELETE /api/v1/onboarding/demo-data (deleteDemoData)', () => {
    it('returns undefined (204 no content) on success', async () => {
      const result = await controller.deleteDemoData();

      expect(result).toBeUndefined();
    });

    it('calls demoDataService.deleteDemoData with tenantId from RequestContext', async () => {
      await controller.deleteDemoData();

      expect(service.deleteDemoData).toHaveBeenCalledWith(mockTenantId);
      expect(service.deleteDemoData).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — second call also returns 204 with no error', async () => {
      await controller.deleteDemoData();
      await controller.deleteDemoData();

      expect(service.deleteDemoData).toHaveBeenCalledTimes(2);
    });

    it('propagates unexpected errors from service', async () => {
      service.deleteDemoData.mockRejectedValue(new Error('DB error'));

      await expect(controller.deleteDemoData()).rejects.toThrow('DB error');
    });
  });

  // ─── GET /api/v1/onboarding/demo-status ──────────────────────────────────

  describe('GET /api/v1/onboarding/demo-status (getDemoStatus)', () => {
    it('returns { data: DemoStatusResult } on success', async () => {
      const result = await controller.getDemoStatus();

      expect(result).toEqual({ data: makeDemoStatus() });
    });

    it('calls demoDataService.getDemoStatus with tenantId from RequestContext', async () => {
      await controller.getDemoStatus();

      expect(service.getDemoStatus).toHaveBeenCalledWith(mockTenantId);
      expect(service.getDemoStatus).toHaveBeenCalledTimes(1);
    });

    it('returns nudgeDismissed=true when service reports dismissal', async () => {
      service.getDemoStatus.mockResolvedValue({ ...makeDemoStatus(), nudgeDismissed: true });

      const result = await controller.getDemoStatus();

      expect(result.data.nudgeDismissed).toBe(true);
    });

    it('returns hasDemoData=false when no demo records exist', async () => {
      service.getDemoStatus.mockResolvedValue({
        hasDemoData: false,
        hasRealData: true,
        demoRecordCount: 0,
        nudgeDismissed: false,
      });

      const result = await controller.getDemoStatus();

      expect(result.data.hasDemoData).toBe(false);
      expect(result.data.demoRecordCount).toBe(0);
    });
  });

  // ─── PATCH /api/v1/onboarding/demo-nudge-dismiss ─────────────────────────

  describe('PATCH /api/v1/onboarding/demo-nudge-dismiss (dismissDemoNudge)', () => {
    it('returns undefined (204 no content) on success', async () => {
      const result = await controller.dismissDemoNudge();

      expect(result).toBeUndefined();
    });

    it('calls demoDataService.dismissNudge with tenantId from RequestContext', async () => {
      await controller.dismissDemoNudge();

      expect(service.dismissNudge).toHaveBeenCalledWith(mockTenantId);
      expect(service.dismissNudge).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — second call also succeeds (overwrites timestamp)', async () => {
      await controller.dismissDemoNudge();
      await controller.dismissDemoNudge();

      expect(service.dismissNudge).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Tenant scope invariant ───────────────────────────────────────────────

  describe('Tenant scope invariant (SEC003)', () => {
    it('deleteDemoData never receives tenantId as parameter — reads from ALS', async () => {
      await controller.deleteDemoData();

      // The method has zero formal parameters — service receives tenantId only via ALS mock
      const call = service.deleteDemoData.mock.calls[0];
      expect(call).toHaveLength(1);
      expect(call[0]).toBe(mockTenantId);
    });

    it('getDemoStatus never receives tenantId as parameter', async () => {
      await controller.getDemoStatus();

      const call = service.getDemoStatus.mock.calls[0];
      expect(call).toHaveLength(1);
      expect(call[0]).toBe(mockTenantId);
    });

    it('dismissDemoNudge never receives tenantId as parameter', async () => {
      await controller.dismissDemoNudge();

      const call = service.dismissNudge.mock.calls[0];
      expect(call).toHaveLength(1);
      expect(call[0]).toBe(mockTenantId);
    });
  });
});
