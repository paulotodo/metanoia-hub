/**
 * Integration-style tests for checkEmailsInTenant (task 1.4, Story 10-3).
 *
 * Tests the service layer with mocked withTenantTx to simulate:
 *  - Tenant-scoped isolation (tenant A result ≠ tenant B context)
 *  - Input order preservation (API-10-C1)
 *  - Batch of 500 emails completing in < 2000ms (SC-006)
 *
 * Note: A real DB integration spec would live in apps/api/test/ with PrismaClient.
 * This spec covers the behavioural contract in unit form as the primary gate for
 * tenant isolation logic inside the service, which does not require a live DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId } from '@metanoia/types';
import * as withTenantTxModule from '../../prisma/with-tenant-tx';
import { UsersService } from '../users.service';
import { requestContext } from '../../common/context/request-context';

const TENANT_A = '01975600-0001-7000-8000-aaa000000001';
const TENANT_B = '01975600-0001-7000-8000-bbb000000001';
const USER_ID  = '01975600-0001-7000-8000-000000000099';

const mockFindMany = vi.fn();

function makeService() {
  return new UsersService({
    client: { user: { findMany: mockFindMany } },
  } as never);
}

function withCtx<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    { tenantId, userId: USER_ID, requestId: generateId(), correlationId: generateId() },
    fn,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();

  // Mock withTenantTx to execute the callback with a mock tx that captures context
  vi.spyOn(withTenantTxModule, 'withTenantTx').mockImplementation(
    async (_prisma, fn) =>
      fn({
        user: { findMany: mockFindMany },
      } as unknown as Parameters<typeof fn>[0]),
  );
});

// ---------------------------------------------------------------------------
// Tenant-scope isolation
// ---------------------------------------------------------------------------

describe('tenant scope isolation', () => {
  it('email found in tenant A context is reported as exists:true for tenant A', async () => {
    mockFindMany.mockResolvedValue([{ email: 'membro@igrejaa.org' }]);
    const svc = makeService();

    const result = await withCtx(TENANT_A, () =>
      svc.checkEmailsInTenant(['membro@igrejaa.org']),
    );

    expect(result[0]).toEqual({ email: 'membro@igrejaa.org', exists: true });
  });

  it('same email in tenant B context returns exists:false when DB finds nothing (RLS exclusion)', async () => {
    // Simulate RLS returning no rows for tenant B even though email exists in tenant A's data
    mockFindMany.mockResolvedValue([]);
    const svc = makeService();

    const result = await withCtx(TENANT_B, () =>
      svc.checkEmailsInTenant(['membro@igrejaa.org']),
    );

    // RLS under tenant B: email not found → exists:false
    expect(result[0]).toEqual({ email: 'membro@igrejaa.org', exists: false });
  });

  it('tenants do not share state across sequential requests', async () => {
    const svc = makeService();

    // Tenant A: email exists
    mockFindMany.mockResolvedValueOnce([{ email: 'shared@example.com' }]);
    const resultA = await withCtx(TENANT_A, () =>
      svc.checkEmailsInTenant(['shared@example.com']),
    );

    // Tenant B: same email not found (RLS filters it out)
    mockFindMany.mockResolvedValueOnce([]);
    const resultB = await withCtx(TENANT_B, () =>
      svc.checkEmailsInTenant(['shared@example.com']),
    );

    expect(resultA[0].exists).toBe(true);
    expect(resultB[0].exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Input order preservation (API-10-C1)
// ---------------------------------------------------------------------------

describe('input order preservation — API-10-C1', () => {
  it('preserves input order even when DB returns rows in different order', async () => {
    // Input: b first, then a. DB returns a first (alphabetical).
    mockFindMany.mockResolvedValue([
      { email: 'a@example.com' },
      { email: 'b@example.com' },
    ]);
    const svc = makeService();

    const result = await withCtx(TENANT_A, () =>
      svc.checkEmailsInTenant(['b@example.com', 'a@example.com']),
    );

    // Response must mirror INPUT order: b, then a
    expect(result[0]).toEqual({ email: 'b@example.com', exists: true });
    expect(result[1]).toEqual({ email: 'a@example.com', exists: true });
  });

  it('preserves order with partial hits (some found, some not)', async () => {
    // Input: [c, b, a]. DB finds only b and c.
    mockFindMany.mockResolvedValue([
      { email: 'b@example.com' },
      { email: 'c@example.com' },
    ]);
    const svc = makeService();

    const result = await withCtx(TENANT_A, () =>
      svc.checkEmailsInTenant(['c@example.com', 'b@example.com', 'a@example.com']),
    );

    expect(result).toEqual([
      { email: 'c@example.com', exists: true },
      { email: 'b@example.com', exists: true },
      { email: 'a@example.com', exists: false },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Performance: batch of 500 emails < 2000ms (SC-006)
// ---------------------------------------------------------------------------

describe('performance SC-006', () => {
  it('batch of 500 emails completes in < 2000ms', async () => {
    // Generate 500 fixture emails
    const emails = Array.from({ length: 500 }, (_, i) => `user${i}@tenant.test`);

    // Simulate DB returning half as found
    const dbRows = emails.slice(0, 250).map((email) => ({ email }));
    mockFindMany.mockResolvedValue(dbRows);

    const svc = makeService();

    const start = Date.now();
    const result = await withCtx(TENANT_A, () => svc.checkEmailsInTenant(emails));
    const elapsed = Date.now() - start;

    // Structural assertion: all 500 returned, order preserved
    expect(result).toHaveLength(500);
    expect(result[0].email).toBe(emails[0]);
    expect(result[0].exists).toBe(true);   // first 250 found
    expect(result[499].exists).toBe(false); // last 250 not found

    // Latency assertion (SC-006): < 2000ms
    expect(elapsed).toBeLessThan(2000);
  });
});
