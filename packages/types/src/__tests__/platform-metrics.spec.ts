import { describe, it, expect } from 'vitest';
import {
  PlatformMetricsSummarySchema,
  PlatformMetricsTenantRowSchema,
  PlatformMetricsTenantListResponseSchema,
  PlatformTenantsQuerySchema,
} from '../platform-metrics';

describe('PlatformMetrics schemas', () => {
  it('PlatformMetricsSummarySchema snapshot', () => {
    const result = PlatformMetricsSummarySchema.parse({
      totalTenants: 10,
      totalUsers: 500,
      activeUsers: 300,
      totalGroups: 50,
      meetingsHeld: 200,
      storageBytesUsed: '1073741824',
      churnedTenants: 2,
      newTenants: 5,
      netGrowth: 3,
    });
    expect(result).toMatchSnapshot();
  });

  it('PlatformMetricsTenantRowSchema snapshot', () => {
    const result = PlatformMetricsTenantRowSchema.parse({
      tenantId: '018e5b3c-0000-7000-8000-000000000001',
      tenantName: 'Igreja Teste',
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
    });
    expect(result).toMatchSnapshot();
  });

  it('PlatformTenantsQuerySchema defaults', () => {
    const result = PlatformTenantsQuerySchema.parse({});
    expect(result).toMatchSnapshot();
  });

  it('PlatformTenantsQuerySchema invalid sortBy → validation error', () => {
    expect(() => PlatformTenantsQuerySchema.parse({ sortBy: 'DROP TABLE' })).toThrow();
  });

  it('PlatformMetricsTenantListResponseSchema snapshot', () => {
    const result = PlatformMetricsTenantListResponseSchema.parse({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0, sortBy: 'tenantName', sortOrder: 'asc' },
    });
    expect(result).toMatchSnapshot();
  });
});
