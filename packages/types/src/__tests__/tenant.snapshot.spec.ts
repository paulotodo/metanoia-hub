import { describe, it, expect } from 'vitest';
import { TenantMeResponseSchema } from '../tenant';

describe('TenantMeResponseSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = TenantMeResponseSchema.safeParse({
      id: '019756c0-0001-7000-8000-000000000001',
      tenantId: '019756c0-0001-7000-8000-000000000002',
      name: 'Igreja Batista Central',
      createdAt: '2026-04-13T12:00:00.000Z',
    });
    const failureCase = TenantMeResponseSchema.safeParse({
      id: 'not-a-uuid',
      tenantId: 'not-a-uuid',
      name: '',
      createdAt: 'not-a-date',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "createdAt": "2026-04-13T12:00:00.000Z",
          "id": "019756c0-0001-7000-8000-000000000001",
          "name": "Igreja Batista Central",
          "tenantId": "019756c0-0001-7000-8000-000000000002",
        },
        "failure": true,
        "success": true,
      }
    `);
  });
});
