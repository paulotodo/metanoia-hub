/**
 * RLS isolation tests for `users.last_seen_at` column (Story 13.3 / FR66-C1).
 *
 * Verifies the new last_seen_at column inherits the existing tenant isolation
 * policy on the `users` table:
 *  1. Tenant A can only read/update its own users' last_seen_at (not Tenant B's)
 *  2. SELECT without app.current_tenant_id returns 0 rows (NULLIF guard)
 *
 * NOTE: requires a running Postgres (DATABASE_APP_URL) — skipped in local
 * unit runs, executed in the dedicated CI RLS step.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

const USER_A_ID = generateId();
const USER_B_ID = generateId();

function makeClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_APP_URL not set');
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
  // users table has FORCE ROW LEVEL SECURITY — set tenant GUC before INSERT.
  // updated_at is @updatedAt NOT NULL without DB default — must supply NOW() (lesson 13-2b).
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, tenant_id, created_at, updated_at, last_seen_at)
       VALUES ('${userId}'::uuid, '${email}', 'Test User', 'active', '${tenantId}'::uuid, NOW(), NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

describe('users.last_seen_at RLS', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = makeClient();
    await ensureTenant(prisma, TENANT_A_ID, 'Igreja Alpha (RLS Test)');
    await ensureTenant(prisma, TENANT_B_ID, 'Igreja Beta (RLS Test)');
    await ensureUser(prisma, USER_A_ID, `lastseen-rls-a-${Date.now()}@test.com`, TENANT_A_ID);
    await ensureUser(prisma, USER_B_ID, `lastseen-rls-b-${Date.now()}@test.com`, TENANT_B_ID);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM users WHERE id IN ('${USER_A_ID}'::uuid, '${USER_B_ID}'::uuid)`,
    );
    await prisma.$disconnect();
  });

  it('Tenant A sees only its own last_seen_at (not Tenant B)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRawUnsafe<{ id: string; last_seen_at: Date | null }[]>(
        `SELECT id::text, last_seen_at FROM users
         WHERE id IN ('${USER_A_ID}'::uuid, '${USER_B_ID}'::uuid)`,
      );
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(USER_A_ID);
    expect(rows[0]?.last_seen_at).not.toBeNull();
  });

  it('Tenant A UPDATE on last_seen_at does not affect Tenant B rows', async () => {
    const affected = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$executeRawUnsafe(
        `UPDATE users SET last_seen_at = now() WHERE id = '${USER_B_ID}'::uuid`,
      );
    });
    expect(affected).toBe(0); // RLS hides Tenant B's row from Tenant A
  });

  it('SELECT without app.current_tenant_id returns 0 rows (NULLIF guard)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM users
         WHERE id IN ('${USER_A_ID}'::uuid, '${USER_B_ID}'::uuid)`,
      );
    });
    expect(Number(rows[0]?.count)).toBe(0);
  });
});
