/**
 * RLS isolation tests for `deletion_requests` table.
 *
 * Story 9-2 (LGPD — Exclusão de Dados Pessoais)
 * spec §AC9 / data-model.md §RLS / tasks.md 1.2.7
 *
 * Tests verify:
 *  1. Tenant A can only see its own deletion_requests (not Tenant B's)
 *  2. Tenant B can only see its own deletion_requests (not Tenant A's)
 *  3. SELECT without SET LOCAL returns 0 rows (NULLIF guard)
 *  4. Worker via prisma.client (superuser, bypasses RLS) sees all tenants
 *  5. UPDATE with tenant-set context does not affect rows from other tenants
 *
 * Fixed UUIDs (hex pattern) per project RLS spec convention — no uuidv7().
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Fixed UUIDs — hex pattern per RLS spec convention
const USER_A_ID = '01912345-6789-7000-8000-ccc000000001';
const USER_B_ID = '01912345-6789-7000-8000-ddd000000001';
const REQUEST_A_ID = '01912345-6789-7000-8000-ccc000000002';
const REQUEST_B_ID = '01912345-6789-7000-8000-ddd000000002';

const CANCELLABLE_UNTIL = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const DELETION_DEADLINE = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

function makeClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_APP_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Superuser client — bypasses RLS (worker pattern, Prisma v7 PrismaPg adapter) */
function makeSuperuserClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL not set');
  // Prisma v7: datasources option removed — use PrismaPg adapter with DATABASE_URL (superuser)
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name, created_at, updated_at)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureUser(
  prisma: PrismaClient,
  userId: string,
  email: string,
  tenantId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, tenant_id, created_at, updated_at)
       VALUES ('${userId}'::uuid, '${email}', 'RLS Test User', 'active', '${tenantId}'::uuid, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function insertDeletionRequest(
  prisma: PrismaClient,
  requestId: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO deletion_requests
        (id, tenant_id, user_id, status, all_tenant_ids,
         cancellable_until, deletion_deadline, created_at, updated_at)
      VALUES (
        '${requestId}'::uuid,
        '${tenantId}'::uuid,
        '${userId}'::uuid,
        'pending',
        ARRAY['${tenantId}']::uuid[],
        '${CANCELLABLE_UNTIL}'::timestamptz,
        '${DELETION_DEADLINE}'::timestamptz,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `);
  });
}

async function countRequestsForTenant(
  prisma: PrismaClient,
  tenantId: string,
  requestId: string,
): Promise<number> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM deletion_requests WHERE id = '${requestId}'::uuid`,
    );
  });
  return Number(rows[0]?.count ?? 0);
}

async function countRequestsWithoutTenant(
  prisma: PrismaClient,
  requestId: string,
): Promise<number> {
  // No SET LOCAL — NULLIF guard should return 0 rows
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM deletion_requests WHERE id = '${requestId}'::uuid`,
  );
  return Number(rows[0]?.count ?? 0);
}

async function cleanupDeletionRequests(prisma: PrismaClient): Promise<void> {
  // Use superuser context to clean up without RLS restriction
  await prisma.$executeRawUnsafe(
    `DELETE FROM deletion_requests WHERE id IN ('${REQUEST_A_ID}'::uuid, '${REQUEST_B_ID}'::uuid)`,
  );
}

describe('deletion_requests RLS', () => {
  let prisma: PrismaClient;
  let superuserPrisma: PrismaClient;

  beforeAll(async () => {
    prisma = makeClient();
    superuserPrisma = makeSuperuserClient();

    await ensureTenant(prisma, TENANT_A_ID, 'Igreja Alpha (Deletion RLS Test)');
    await ensureTenant(prisma, TENANT_B_ID, 'Igreja Beta (Deletion RLS Test)');
    await ensureUser(prisma, USER_A_ID, 'rls-deletion-a@test.com', TENANT_A_ID);
    await ensureUser(prisma, USER_B_ID, 'rls-deletion-b@test.com', TENANT_B_ID);
    await insertDeletionRequest(prisma, REQUEST_A_ID, TENANT_A_ID, USER_A_ID);
    await insertDeletionRequest(prisma, REQUEST_B_ID, TENANT_B_ID, USER_B_ID);
  });

  afterAll(async () => {
    await cleanupDeletionRequests(superuserPrisma);
    await prisma.$disconnect();
    await superuserPrisma.$disconnect();
  });

  it('tenant A sees its own deletion request', async () => {
    const count = await countRequestsForTenant(prisma, TENANT_A_ID, REQUEST_A_ID);
    expect(count).toBe(1);
  });

  it('tenant A does NOT see tenant B deletion request', async () => {
    const count = await countRequestsForTenant(prisma, TENANT_A_ID, REQUEST_B_ID);
    expect(count).toBe(0);
  });

  it('tenant B sees its own deletion request', async () => {
    const count = await countRequestsForTenant(prisma, TENANT_B_ID, REQUEST_B_ID);
    expect(count).toBe(1);
  });

  it('tenant B does NOT see tenant A deletion request', async () => {
    const count = await countRequestsForTenant(prisma, TENANT_B_ID, REQUEST_A_ID);
    expect(count).toBe(0);
  });

  it('SELECT without SET LOCAL returns 0 rows (NULLIF guard)', async () => {
    const countA = await countRequestsWithoutTenant(prisma, REQUEST_A_ID);
    const countB = await countRequestsWithoutTenant(prisma, REQUEST_B_ID);
    expect(countA).toBe(0);
    expect(countB).toBe(0);
  });

  it('worker (superuser, bypasses RLS) sees deletion requests from all tenants', async () => {
    const rows = await superuserPrisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM deletion_requests WHERE id IN ('${REQUEST_A_ID}'::uuid, '${REQUEST_B_ID}'::uuid)`,
    );
    expect(rows).toHaveLength(2);
  });

  it('UPDATE with tenant A context does not affect tenant B request', async () => {
    // Attempt to update REQUEST_B as tenant A — RLS should block (UPDATE sees 0 rows)
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      await tx.$executeRawUnsafe(
        `UPDATE deletion_requests SET status = 'cancelled' WHERE id = '${REQUEST_B_ID}'::uuid`,
      );
    });

    // Verify REQUEST_B status unchanged via superuser
    const rows = await superuserPrisma.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM deletion_requests WHERE id = '${REQUEST_B_ID}'::uuid`,
    );
    expect(rows[0]?.status).toBe('pending');
  });

  it('audit anonimização 0-rows: UPDATE anonymized_user_ref with 0 rows does not error', async () => {
    // Verifies that hard-delete anonimização UPDATE of audit_events is safe in 0-rows case.
    // This tests the imutabilidade invariant (9-3): UPDATE returns 0 rows without error.
    const nonExistentUserId = '01999999-9999-7000-8000-000000000099';
    const result = await superuserPrisma.$queryRawUnsafe<Array<{ updated: bigint }>>(
      `WITH upd AS (
         UPDATE audit_events
         SET user_id = NULL, anonymized_user_ref = 'anonymous-test0000'
         WHERE user_id = '${nonExistentUserId}'::uuid
         AND tenant_id = '${TENANT_A_ID}'::uuid
         RETURNING 1
       )
       SELECT COUNT(*) as updated FROM upd`,
    );
    // 0 rows updated — no error
    expect(Number(result[0]?.updated ?? 0)).toBe(0);
  });
});
