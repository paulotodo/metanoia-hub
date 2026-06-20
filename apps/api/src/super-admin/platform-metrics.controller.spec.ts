import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { PlatformMetricsController } from './platform-metrics.controller';
import { PlatformMetricsService } from './platform-metrics.service';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockSummary = {
  data: {
    totalTenants: 5,
    totalUsers: 200,
    activeUsers: 120,
    totalGroups: 25,
    meetingsHeld: 80,
    storageBytesUsed: '536870912',
    churnedTenants: 1,
    newTenants: 2,
    netGrowth: 1,
  },
  meta: { generatedAt: '2026-06-20T00:00:00.000Z', cacheTTL: 60 },
};

const mockTenantsResponse = {
  data: [
    {
      tenantId: '018e5b3c-0000-7000-8000-000000000001',
      tenantName: 'Igreja A',
      tenantPlan: 'pro',
      tenantStatus: 'active',
      tenantCreatedAt: '2026-01-01T00:00:00.000Z',
      totalUsers: 50,
      activeUsers: 30,
      activeCurrentMonth: true,
      activePrevMonth: true,
      totalGroups: 5,
      meetingsHeld: 20,
      storageBytesUsed: '10485760',
      refreshedAt: '2026-06-20T00:00:00.000Z',
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1, sortBy: 'tenantName', sortOrder: 'asc' },
};

const makeMockService = () => ({
  getSummary: vi.fn().mockResolvedValue(mockSummary),
  getTenants: vi.fn().mockResolvedValue(mockTenantsResponse),
  triggerRefresh: vi.fn().mockResolvedValue({ message: 'Refresh enfileirado com sucesso', jobId: 'job-123' }),
});

describe('PlatformMetricsController', () => {
  let controller: PlatformMetricsController;
  let service: ReturnType<typeof makeMockService>;

  beforeEach(async () => {
    service = makeMockService();
    const module = await Test.createTestingModule({
      controllers: [PlatformMetricsController],
      providers: [{ provide: PlatformMetricsService, useValue: service }],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(PlatformMetricsController);
  });

  describe('GET /summary', () => {
    it('returns summary from service', async () => {
      const result = await controller.getSummary();
      expect(result).toEqual(mockSummary);
      expect(service.getSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /tenants', () => {
    it('passes parsed query to service', async () => {
      const result = await controller.getTenants({ page: '1', limit: '20', sortBy: 'tenantName', sortOrder: 'asc' });
      expect(result).toEqual(mockTenantsResponse);
      expect(service.getTenants).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
        sortBy: 'tenantName',
        sortOrder: 'asc',
        plan: undefined,
        status: undefined,
      });
    });

    it('rejects invalid sortBy (SEC-02 anti-injection)', async () => {
      await expect(
        controller.getTenants({ sortBy: 'DROP TABLE--' }),
      ).rejects.toThrow();
    });

    it('accepts optional plan and status filters', async () => {
      await controller.getTenants({ plan: 'pro', status: 'active' });
      expect(service.getTenants).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'pro', status: 'active' }),
      );
    });
  });

  describe('POST /refresh', () => {
    it('triggers refresh and returns job info', async () => {
      const result = await controller.triggerRefresh();
      expect(result).toEqual({ message: 'Refresh enfileirado com sucesso', jobId: 'job-123' });
      expect(service.triggerRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
