import { describe, it, expect } from 'vitest';
import {
  InviteStatusSchema,
  InviteValidateResponseSchema,
  AcceptTermsRequestSchema,
  AcceptTermsResponseSchema,
  CreateAccountRequestSchema,
  CreateAccountResponseSchema,
  InviteResolveResponseSchema,
  AcceptParticipantInviteResponseSchema,
} from '../invite';

describe('InviteStatusSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = InviteStatusSchema.safeParse('valid');
    const failureCase = InviteStatusSchema.safeParse('unknown');
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "valid",
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('InviteValidateResponseSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = InviteValidateResponseSchema.safeParse({
      status: 'valid',
      leader: { name: 'Pastor João', email: 'joao@example.com' },
      tenant: { name: 'Igreja Semente', id: '019756c0-0001-7000-8000-000000000001' },
    });
    const failureCase = InviteValidateResponseSchema.safeParse({ status: 'bogus' });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "leader": {
            "email": "joao@example.com",
            "name": "Pastor João",
          },
          "status": "valid",
          "tenant": {
            "id": "019756c0-0001-7000-8000-000000000001",
            "name": "Igreja Semente",
          },
        },
        "failure": true,
        "success": true,
      }
    `);
  });

  it('accepts null tenant (pre-activation invite)', () => {
    const result = InviteValidateResponseSchema.safeParse({
      status: 'valid',
      leader: { name: 'Pastor João', email: 'joao@example.com' },
      tenant: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('AcceptTermsRequestSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = AcceptTermsRequestSchema.safeParse({ termsVersion: '2026-04-01' });
    const failureCase = AcceptTermsRequestSchema.safeParse({ termsVersion: '' });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "termsVersion": "2026-04-01",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('AcceptTermsResponseSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = AcceptTermsResponseSchema.safeParse({
      acceptedAt: '2026-04-13T12:00:00.000Z',
    });
    const failureCase = AcceptTermsResponseSchema.safeParse({ acceptedAt: 'not-a-date' });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "acceptedAt": "2026-04-13T12:00:00.000Z",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('CreateAccountRequestSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = CreateAccountRequestSchema.safeParse({
      name: 'Pastor João',
      email: 'joao@example.com',
      password: 'super-secret',
      churchName: 'Igreja Semente',
    });
    const failureCase = CreateAccountRequestSchema.safeParse({
      name: 'J',
      email: 'not-an-email',
      password: 'short',
      churchName: '',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "churchName": "Igreja Semente",
          "email": "joao@example.com",
          "name": "Pastor João",
          "password": "super-secret",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('InviteResolveResponseSchema snapshot', () => {
  it('accepts an admin-tenant valid invite', () => {
    const result = InviteResolveResponseSchema.safeParse({
      status: 'valid',
      invite: {
        kind: 'admin-tenant',
        leader: { name: 'Pastor João', email: 'joao@example.com' },
        tenant: { id: '019756c0-0001-7000-8000-000000000001', name: 'Igreja Semente' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a participant valid invite', () => {
    const result = InviteResolveResponseSchema.safeParse({
      status: 'valid',
      invite: {
        kind: 'participant',
        leader: { firstName: 'Marcos', avatarUrl: null },
        tenant: { id: '019756c0-0001-7000-8000-000000000001', name: 'Igreja Semente' },
        group: { id: '019756c0-2000-7000-8000-000000000001', name: 'Fundamentos da Fé' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts an expired invite with null payload', () => {
    const result = InviteResolveResponseSchema.safeParse({
      status: 'expired',
      invite: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a participant invite missing the group field', () => {
    const result = InviteResolveResponseSchema.safeParse({
      status: 'valid',
      invite: {
        kind: 'participant',
        leader: { firstName: 'Marcos', avatarUrl: null },
        tenant: { id: '019756c0-0001-7000-8000-000000000001', name: 'Igreja Semente' },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invite with unknown kind', () => {
    const result = InviteResolveResponseSchema.safeParse({
      status: 'valid',
      invite: {
        kind: 'alien',
        leader: { firstName: 'Marcos', avatarUrl: null },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('AcceptParticipantInviteResponseSchema snapshot', () => {
  it('freezes participant accept shape', () => {
    const result = AcceptParticipantInviteResponseSchema.safeParse({
      accessToken: 'access.jwt.token',
      refreshToken: 'refresh.jwt.token',
      tenantId: '019756c0-0001-7000-8000-000000000001',
      groupId: '019756c0-2000-7000-8000-000000000001',
      userId: '019756c0-0001-7000-8000-000000000042',
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateAccountResponseSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = CreateAccountResponseSchema.safeParse({
      accessToken: 'access.jwt.token',
      refreshToken: 'refresh.jwt.token',
      tenantId: '019756c0-0001-7000-8000-000000000001',
      userId: '019756c0-0001-7000-8000-000000000002',
      email: 'joao@example.com',
    });
    const failureCase = CreateAccountResponseSchema.safeParse({
      accessToken: 'access.jwt.token',
      refreshToken: 'refresh.jwt.token',
      tenantId: 'not-a-uuid',
      userId: 'not-a-uuid',
      email: 'not-an-email',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "accessToken": "access.jwt.token",
          "email": "joao@example.com",
          "refreshToken": "refresh.jwt.token",
          "tenantId": "019756c0-0001-7000-8000-000000000001",
          "userId": "019756c0-0001-7000-8000-000000000002",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});
