import { describe, it, expect } from 'vitest';
import {
  InviteStatusSchema,
  InviteValidateResponseSchema,
  AcceptTermsRequestSchema,
  AcceptTermsResponseSchema,
  CreateAccountRequestSchema,
  CreateAccountResponseSchema,
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
