/**
 * RLS isolation and immutability tests for `audit_events` table.
 *
 * Story 9-3 (LGPD — Immutable Audit Log)
 * FR-003, FR-004 (tenant isolation), SC-002 (immutability), SC-007 (no cross-tenant read)
 *
 * Tests verify:
 *  1. Tenant A can only see its own events (not Tenant B's)
 *  2. UPDATE is rejected (no policy exists for UPDATE)
 *  3. DELETE is rejected (no policy exists for DELETE)
 *  4. SELECT without SET LOCAL returns 0 rows (NULLIF ensures empty string = NULL)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Fixed UUIDs that satisfy hex-only constraint for UUID columns
const AUDIT_USER_A_ID = '01912345-6789-7000-8000-aaaaaaaaaaaa';
const AUDIT_USER_B_ID = '01912345-6789-7000-8000-bbbbbbbbbbbb';

function makeClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_APP_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  // RLS on `tenants` (tenant_id = current_setting('app.current_tenant_id')) blocks
  // a bare INSERT — the GUC must be set within the transaction first.
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
  // users table has FORCE ROW LEVEL SECURITY — set tenant GUC before INSERT.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, tenant_id, created_at, updated_at)
       VALUES ('${userId}'::uuid, '${email}', 'Test User', 'active', '${tenantId}'::uuid, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function insertAuditEvent(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
  resource: string,
): Promise<string> {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO audit_events (id, tenant_id, user_id, action, resource, ip_address, user_agent, timestamp, severity)
      VALUES (
        '${id}'::uuid,
        '${tenantId}'::uuid,
        '${userId}'::uuid,
        'create',
        '${resource}',
        '127.0.0.1',
        'vitest/rls-test',
        NOW(),
        'info'
      )
    `);
  });
  return id;
}

describe('audit_events RLS', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = makeClient();
    // Setup tenants and users using admin connection (no RLS context needed for tenants)
    await ensureTenant(prisma, TENANT_A_ID, 'Igreja Alpha (RLS Test)');
    await ensureTenant(prisma, TENANT_B_ID, 'Igreja Beta (RLS Test)');
    await ensureUser(prisma, AUDIT_USER_A_ID, `audit-rls-a-${Date.now()}@test.com`, TENANT_A_ID);
    await ensureUser(prisma, AUDIT_USER_B_ID, `audit-rls-b-${Date.now()}@test.com`, TENANT_B_ID);

    // Insert 3 events for Tenant A
    await insertAuditEvent(prisma, TENANT_A_ID, AUDIT_USER_A_ID, 'user');
    await insertAuditEvent(prisma, TENANT_A_ID, AUDIT_USER_A_ID, 'group');
    await insertAuditEvent(prisma, TENANT_A_ID, AUDIT_USER_A_ID, 'trail');

    // Insert 2 events for Tenant B
    await insertAuditEvent(prisma, TENANT_B_ID, AUDIT_USER_B_ID, 'user');
    await insertAuditEvent(prisma, TENANT_B_ID, AUDIT_USER_B_ID, 'group');
  });

  afterAll(async () => {
    // Cleanup: delete test events (admin connection bypasses RLS)
    await prisma.$executeRawUnsafe(`
      DELETE FROM audit_events
      WHERE user_id IN ('${AUDIT_USER_A_ID}'::uuid, '${AUDIT_USER_B_ID}'::uuid)
    `);
    await prisma.$disconnect();
  });

  // ─── SC-007: Tenant isolation ─────────────────────────────────────────────

  it('Tenant A sees exactly 3 events (not Tenant B events)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM audit_events WHERE user_id = '${AUDIT_USER_A_ID}'::uuid`,
      );
    });
    expect(Number(rows[0]?.count)).toBe(3);
  });

  it('Tenant A cannot see Tenant B events', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM audit_events WHERE user_id = '${AUDIT_USER_B_ID}'::uuid`,
      );
    });
    expect(Number(rows[0]?.count)).toBe(0);
  });

  it('Tenant B sees exactly 2 events (not Tenant A events)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
      return tx.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM audit_events WHERE user_id = '${AUDIT_USER_B_ID}'::uuid`,
      );
    });
    expect(Number(rows[0]?.count)).toBe(2);
  });

  // ─── SC-002: Immutability — UPDATE rejected ────────────────────────────────

  // Postgres RLS with FORCE + no permissive UPDATE/DELETE policy does NOT raise an
  // error: it silently filters every row out of the command's scope, so the
  // statement affects 0 rows. Immutability is therefore asserted as "0 rows
  // affected AND the rows survive unchanged" — a stronger guarantee than a throw.
  async function countEventsForUserA(): Promise<number> {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM audit_events WHERE user_id = '${AUDIT_USER_A_ID}'::uuid`,
      );
    });
    return Number(rows[0]?.count);
  }

  it('UPDATE is rejected — no UPDATE policy, 0 rows affected (immutable)', async () => {
    const affected = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      // No permissive UPDATE policy → RLS filters all rows → 0 rows affected, no error.
      return tx.$executeRawUnsafe(
        `UPDATE audit_events SET action = 'delete' WHERE user_id = '${AUDIT_USER_A_ID}'::uuid`,
      );
    });
    expect(affected).toBe(0);
    // No row was flipped to 'delete' — original events untouched.
    const mutated = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM audit_events WHERE user_id = '${AUDIT_USER_A_ID}'::uuid AND action = 'delete'`,
      );
    });
    expect(Number(mutated[0]?.count)).toBe(0);
  });

  // ─── SC-002: Immutability — DELETE rejected ────────────────────────────────

  it('DELETE is rejected — no DELETE policy, 0 rows affected (immutable)', async () => {
    const before = await countEventsForUserA();
    expect(before).toBeGreaterThan(0);
    const affected = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      // No permissive DELETE policy → RLS filters all rows → 0 rows affected, no error.
      return tx.$executeRawUnsafe(
        `DELETE FROM audit_events WHERE user_id = '${AUDIT_USER_A_ID}'::uuid`,
      );
    });
    expect(affected).toBe(0);
    // Rows survive — the audit trail cannot be erased.
    expect(await countEventsForUserA()).toBe(before);
  });

  // ─── NULLIF guard: SELECT without SET LOCAL returns 0 rows ─────────────────

  it('SELECT without app.current_tenant_id returns 0 rows (NULLIF guard)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      // Explicitly reset to empty string — NULLIF converts '' → NULL → no match
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM audit_events`,
      );
    });
    expect(Number(rows[0]?.count)).toBe(0);
  });
});
