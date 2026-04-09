import { describe, it, expect } from 'vitest';
import { generateId } from '@metanoia/types';
import { requestContext } from '../../src/common/context/request-context';
import { createUser, createUserTenant, createConsent } from '../factories/user.factory';

describe('Users RLS Isolation', () => {
  const tenantA = generateId();
  const tenantB = generateId();

  it('should create user factory with correct tenant', () => {
    const user = createUser({ tenantId: tenantA });
    expect(user.tenantId).toBe(tenantA);
    expect(user.id).toBeDefined();
    expect(user.status).toBe('pending_verification');
  });

  it('should create user without tenant (registration flow)', () => {
    const user = createUser();
    expect(user.tenantId).toBeNull();
  });

  it('should isolate request context per tenant', async () => {
    const results: string[] = [];

    await requestContext.run(
      { tenantId: tenantA, userId: generateId(), requestId: generateId(), correlationId: generateId() },
      async () => {
        const ctx = requestContext.getStore();
        results.push(ctx!.tenantId);
      },
    );

    await requestContext.run(
      { tenantId: tenantB, userId: generateId(), requestId: generateId(), correlationId: generateId() },
      async () => {
        const ctx = requestContext.getStore();
        results.push(ctx!.tenantId);
      },
    );

    expect(results).toEqual([tenantA, tenantB]);
    expect(results[0]).not.toBe(results[1]);
  });

  it('should create user_tenant with correct tenant isolation', () => {
    const user = createUser({ tenantId: tenantA });
    const userTenant = createUserTenant({ userId: user.id, tenantId: tenantA });
    expect(userTenant.tenantId).toBe(tenantA);
    expect(userTenant.userId).toBe(user.id);
    expect(userTenant.role).toBe('participante');
  });

  it('should create consent with nullable tenant for platform-level consent', () => {
    const user = createUser();
    const consent = createConsent({ userId: user.id });
    expect(consent.tenantId).toBeNull();
    expect(consent.documentType).toBe('terms_of_service');
  });

  it('should create consent with tenant for tenant-scoped consent', () => {
    const user = createUser({ tenantId: tenantA });
    const consent = createConsent({ userId: user.id, tenantId: tenantA });
    expect(consent.tenantId).toBe(tenantA);
  });
});
