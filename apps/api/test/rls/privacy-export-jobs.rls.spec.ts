/**
 * RLS isolation tests for `privacy_export_jobs` table.
 *
 * Story 9-1 (LGPD — Exportação de Dados Pessoais)
 * AC9: tenant A cannot see jobs created by tenant B.
 *
 * Tests verify:
 *  1. Job created for tenant A is visible when current_tenant_id = A
 *  2. Job created for tenant A is NOT visible when current_tenant_id = B
 *  3. Job created for tenant B is visible when current_tenant_id = B
 *  4. Job created for tenant B is NOT visible when current_tenant_id = A
 *
 * Pattern: PrismaPg adapter + UUIDs hex-fixed (no uuidv7 in fixtures)
 * Matches existing RLS spec pattern (audit-events.rls-spec.ts, consent-records.rls-spec.ts).
 *
 * Requires: DATABASE_APP_URL env var pointing to a real Postgres instance.
 * Skip silently if not set (CI without Docker).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ─── Fixed UUIDs (hex — no uuidv7) ───────────────────────────────────────────
const USER_A_ID = '0191aaaa-0001-7000-8000-000000000001';
const USER_B_ID = '0191aaaa-0002-7000-8000-000000000002';
const JOB_A_ID = '0191bbbb-0001-7000-8000-000000000010';
const JOB_B_ID = '0191bbbb-0002-7000-8000-000000000020';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient(): PrismaClient | null {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) return null;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenants (id, tenant_id, name, created_at, updated_at)
     VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function ensureUser(prisma: PrismaClient, userId: string, email: string, tenantId: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, tenant_id, created_at, updated_at)
     VALUES ('${userId}'::uuid, '${email}', 'Test User', 'active', '${tenantId}'::uuid, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function insertJob(
  prisma: PrismaClient,
  opts: { jobId: string; tenantId: string; userId: string },
): Promise<void> {
  // Insert bypassing RLS (superuser context — no current_tenant_id GUC)
  await prisma.$executeRawUnsafe(`
    INSERT INTO privacy_export_jobs
      (id, tenant_id, user_id, format, status, all_tenant_ids, requested_at, created_at)
    VALUES
      ('${opts.jobId}'::uuid,
       '${opts.tenantId}'::uuid,
       '${opts.userId}'::uuid,
       'json',
       'completed',
       ARRAY['${opts.tenantId}'::uuid],
       NOW(),
       NOW())
    ON CONFLICT (id) DO NOTHING
  `);
}

async function selectJobsWithTenant(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ id: string }[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM privacy_export_jobs`,
    );
  });
}

async function cleanupJobs(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM privacy_export_jobs WHERE id IN ('${JOB_A_ID}'::uuid, '${JOB_B_ID}'::uuid)`,
  );
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('privacy_export_jobs RLS isolation (AC9)', () => {
  let prisma: PrismaClient | null = null;

  beforeAll(async () => {
    prisma = makeClient();
    if (!prisma) return;

    await ensureTenant(prisma, TENANT_A_ID, 'Igreja Alfa (RLS Test)');
    await ensureTenant(prisma, TENANT_B_ID, 'Igreja Beta (RLS Test)');
    await ensureUser(prisma, USER_A_ID, 'user-a@rls-test.example.com', TENANT_A_ID);
    await ensureUser(prisma, USER_B_ID, 'user-b@rls-test.example.com', TENANT_B_ID);
    await insertJob(prisma, { jobId: JOB_A_ID, tenantId: TENANT_A_ID, userId: USER_A_ID });
    await insertJob(prisma, { jobId: JOB_B_ID, tenantId: TENANT_B_ID, userId: USER_B_ID });
  });

  afterAll(async () => {
    if (!prisma) return;
    await cleanupJobs(prisma);
    await prisma.$disconnect();
  });

  it('skips tests when DATABASE_APP_URL is not set', () => {
    if (!prisma) {
      expect(true).toBe(true); // no-op: CI without Docker
      return;
    }
    // Covered by subsequent tests
    expect(prisma).toBeDefined();
  });

  it('tenant A sees its own job', async () => {
    if (!prisma) return;

    const rows = await selectJobsWithTenant(prisma, TENANT_A_ID);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(JOB_A_ID);
  });

  it('tenant A does NOT see job from tenant B', async () => {
    if (!prisma) return;

    const rows = await selectJobsWithTenant(prisma, TENANT_A_ID);
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(JOB_B_ID);
  });

  it('tenant B sees its own job', async () => {
    if (!prisma) return;

    const rows = await selectJobsWithTenant(prisma, TENANT_B_ID);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(JOB_B_ID);
  });

  it('tenant B does NOT see job from tenant A', async () => {
    if (!prisma) return;

    const rows = await selectJobsWithTenant(prisma, TENANT_B_ID);
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(JOB_A_ID);
  });
});
