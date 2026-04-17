import { describe, it, expect } from 'vitest';
import {
  UserTenantRoleSchema,
  UserTenantSchema,
  MyTenantsResponseSchema,
  SelectTenantInputSchema,
  SelectTenantResponseSchema,
} from '../index';

describe('UserTenantRoleSchema snapshot', () => {
  it('accepts the three known roles', () => {
    expect(UserTenantRoleSchema.safeParse('leader').success).toBe(true);
    expect(UserTenantRoleSchema.safeParse('admin_tenant').success).toBe(true);
    expect(UserTenantRoleSchema.safeParse('participant').success).toBe(true);
  });

  it('rejects unknown roles', () => {
    expect(UserTenantRoleSchema.safeParse('super_admin').success).toBe(false);
    expect(UserTenantRoleSchema.safeParse('').success).toBe(false);
  });
});

describe('UserTenantSchema snapshot', () => {
  it('freezes a valid user tenant with lastVisit', () => {
    const result = UserTenantSchema.safeParse({
      tenantId: '019756d0-0001-7000-8000-000000000001',
      churchName: 'Igreja Batista Central',
      userRole: 'leader',
      lastVisit: '2026-04-16T18:00:00.000Z',
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "churchName": "Igreja Batista Central",
          "lastVisit": "2026-04-16T18:00:00.000Z",
          "tenantId": "019756d0-0001-7000-8000-000000000001",
          "userRole": "leader",
        },
        "success": true,
      }
    `);
  });

  it('accepts null lastVisit (first visit)', () => {
    const result = UserTenantSchema.safeParse({
      tenantId: '019756d0-0001-7000-8000-000000000002',
      churchName: 'Comunidade Graça',
      userRole: 'admin_tenant',
      lastVisit: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid tenantId (not a UUID)', () => {
    const result = UserTenantSchema.safeParse({
      tenantId: 'not-a-uuid',
      churchName: 'X',
      userRole: 'leader',
      lastVisit: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid lastVisit (not ISO datetime)', () => {
    const result = UserTenantSchema.safeParse({
      tenantId: '019756d0-0001-7000-8000-000000000003',
      churchName: 'Igreja X',
      userRole: 'participant',
      lastVisit: '2026-04-16',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty churchName', () => {
    const result = UserTenantSchema.safeParse({
      tenantId: '019756d0-0001-7000-8000-000000000004',
      churchName: '',
      userRole: 'leader',
      lastVisit: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('MyTenantsResponseSchema snapshot', () => {
  it('freezes the response shape with multiple tenants', () => {
    const result = MyTenantsResponseSchema.safeParse({
      data: [
        {
          tenantId: '019756d0-0001-7000-8000-000000000001',
          churchName: 'Igreja Batista Central',
          userRole: 'leader',
          lastVisit: '2026-04-16T18:00:00.000Z',
        },
        {
          tenantId: '019756d0-0001-7000-8000-000000000002',
          churchName: 'Comunidade Graça',
          userRole: 'admin_tenant',
          lastVisit: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty tenant list', () => {
    const result = MyTenantsResponseSchema.safeParse({ data: [] });
    expect(result.success).toBe(true);
  });
});

describe('SelectTenantInputSchema snapshot', () => {
  it('freezes a valid selection payload', () => {
    const result = SelectTenantInputSchema.safeParse({
      tenantId: '019756d0-0001-7000-8000-000000000001',
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "tenantId": "019756d0-0001-7000-8000-000000000001",
        },
        "success": true,
      }
    `);
  });

  it('rejects non-UUID tenantId', () => {
    expect(SelectTenantInputSchema.safeParse({ tenantId: 'abc' }).success).toBe(
      false,
    );
  });
});

describe('SelectTenantResponseSchema snapshot', () => {
  it('freezes the response shape', () => {
    const result = SelectTenantResponseSchema.safeParse({
      data: { tenantId: '019756d0-0001-7000-8000-000000000001' },
    });
    expect(result.success).toBe(true);
  });
});
