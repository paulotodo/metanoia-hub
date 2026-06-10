import { describe, it, expect } from 'vitest';
import {
  TenantSummarySchema,
  TenantsListResponseSchema,
  TenantDetailSchema,
  ProvisionTenantInputSchema,
  ProvisionStatusDataSchema,
  TenantPatchInputSchema,
} from '../super-admin-tenant';

const TENANT_ID = '019800a0-0000-7000-8000-000000000001';

describe('TenantSummarySchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const success = TenantSummarySchema.safeParse({
      id: TENANT_ID,
      name: 'Igreja Restauração',
      slug: 'igreja-restauracao',
      plan: 'pro',
      status: 'active',
      memberCount: 142,
      createdAt: '2026-04-01T12:00:00.000Z',
    });
    const failure = TenantSummarySchema.safeParse({
      id: 'not-uuid',
      name: '',
      slug: '',
      plan: 'gold',
      status: 'archived',
      memberCount: -1,
      createdAt: 'never',
    });
    expect({
      success: success.success,
      data: success.success ? success.data : null,
      failure: !failure.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "createdAt": "2026-04-01T12:00:00.000Z",
          "id": "019800a0-0000-7000-8000-000000000001",
          "memberCount": 142,
          "name": "Igreja Restauração",
          "plan": "pro",
          "slug": "igreja-restauracao",
          "status": "active",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('TenantsListResponseSchema snapshot', () => {
  it('requires pagination meta', () => {
    const result = TenantsListResponseSchema.safeParse({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(result.success).toBe(true);

    const missingMeta = TenantsListResponseSchema.safeParse({ data: [] });
    expect(missingMeta.success).toBe(false);
  });
});

describe('TenantDetailSchema', () => {
  it('accepts full payload with aggregates, invite status, updatedAt, and metadata', () => {
    const result = TenantDetailSchema.safeParse({
      id: TENANT_ID,
      name: 'Igreja Restauração',
      slug: 'igreja-restauracao',
      plan: 'free',
      status: 'active',
      createdAt: '2026-04-01T12:00:00.000Z',
      updatedAt: '2026-06-10T10:30:00.000Z',
      adminEmail: 'admin@restauracao.org',
      inviteStatus: 'sent',
      memberCount: 142,
      groupCount: 12,
      leaderCount: 5,
      metadata: { support_tier: 'gold' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.updatedAt).toBe('2026-06-10T10:30:00.000Z');
      expect(result.data.metadata).toEqual({ support_tier: 'gold' });
    }
  });

  it('defaults metadata to empty object when omitted', () => {
    const result = TenantDetailSchema.safeParse({
      id: TENANT_ID,
      name: 'Igreja Restauração',
      slug: 'igreja-restauracao',
      plan: 'free',
      status: 'active',
      createdAt: '2026-04-01T12:00:00.000Z',
      updatedAt: '2026-06-10T10:30:00.000Z',
      adminEmail: 'admin@restauracao.org',
      inviteStatus: 'sent',
      memberCount: 142,
      groupCount: 12,
      leaderCount: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({});
    }
  });

  it('rejects negative aggregate counts', () => {
    const result = TenantDetailSchema.safeParse({
      id: TENANT_ID,
      name: 'X',
      slug: 'x',
      plan: 'free',
      status: 'active',
      createdAt: '2026-04-01T12:00:00.000Z',
      updatedAt: '2026-06-10T10:30:00.000Z',
      adminEmail: 'a@b.com',
      inviteStatus: 'pending',
      memberCount: -1,
      groupCount: 0,
      leaderCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing updatedAt', () => {
    const result = TenantDetailSchema.safeParse({
      id: TENANT_ID,
      name: 'Igreja Restauração',
      slug: 'igreja-restauracao',
      plan: 'free',
      status: 'active',
      createdAt: '2026-04-01T12:00:00.000Z',
      adminEmail: 'admin@restauracao.org',
      inviteStatus: 'sent',
      memberCount: 142,
      groupCount: 12,
      leaderCount: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe('ProvisionTenantInputSchema', () => {
  it('accepts a valid provisioning payload', () => {
    const result = ProvisionTenantInputSchema.safeParse({
      name: 'Igreja Restauração',
      slug: 'igreja-restauracao',
      adminEmail: 'admin@restauracao.org',
      plan: 'pro',
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed slug', () => {
    const r1 = ProvisionTenantInputSchema.safeParse({
      name: 'Igreja Restauração',
      slug: 'Igreja Restauração',
      adminEmail: 'admin@restauracao.org',
      plan: 'pro',
    });
    expect(r1.success).toBe(false);

    const r2 = ProvisionTenantInputSchema.safeParse({
      name: 'Igreja Restauração',
      slug: '-bad-',
      adminEmail: 'admin@restauracao.org',
      plan: 'pro',
    });
    expect(r2.success).toBe(false);
  });

  it('rejects short name and invalid email', () => {
    const r = ProvisionTenantInputSchema.safeParse({
      name: 'AB',
      slug: 'ab',
      adminEmail: 'not-an-email',
      plan: 'free',
    });
    expect(r.success).toBe(false);
  });
});

describe('ProvisionStatusDataSchema', () => {
  it('accepts running step 2', () => {
    const result = ProvisionStatusDataSchema.safeParse({
      step: 2,
      status: 'running',
      failedAt: null,
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts failure with reason', () => {
    const result = ProvisionStatusDataSchema.safeParse({
      step: 2,
      status: 'failed',
      failedAt: 'keycloak',
      error: 'realm creation timed out',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown saga step', () => {
    const result = ProvisionStatusDataSchema.safeParse({
      step: 4,
      status: 'running',
      failedAt: null,
      error: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('TenantPatchInputSchema', () => {
  it('accepts rename only', () => {
    expect(
      TenantPatchInputSchema.safeParse({ name: 'New Name' }).success,
    ).toBe(true);
  });

  it('accepts status change only', () => {
    expect(
      TenantPatchInputSchema.safeParse({ status: 'suspended' }).success,
    ).toBe(true);
  });

  it('rejects empty body (no fields)', () => {
    expect(TenantPatchInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects forbidden status transitions (provisioning, failed)', () => {
    expect(
      TenantPatchInputSchema.safeParse({ status: 'provisioning' }).success,
    ).toBe(false);
    expect(
      TenantPatchInputSchema.safeParse({ status: 'provisioning_failed' })
        .success,
    ).toBe(false);
  });

  it('accepts metadata only patch', () => {
    expect(
      TenantPatchInputSchema.safeParse({ metadata: { support_tier: 'gold' } }).success,
    ).toBe(true);
  });

  it('accepts combined name + metadata patch', () => {
    expect(
      TenantPatchInputSchema.safeParse({
        name: 'Igreja Nova',
        metadata: { custom_flag: true },
      }).success,
    ).toBe(true);
  });
});
