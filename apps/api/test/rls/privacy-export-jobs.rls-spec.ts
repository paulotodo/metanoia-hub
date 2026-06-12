/**
 * RLS isolation tests for `privacy_export_jobs` table.
 *
 * Story 9-1 (LGPD — Exportação de Dados Pessoais)
 * spec §AC9, §NFR-T1, data-model.md §RLS
 *
 * Tests verify:
 *  1. Tenant A can only see its own jobs (not Tenant B's)
 *  2. Tenant B can only see its own jobs (not Tenant A's)
 *  3. SELECT without SET LOCAL returns 0 rows (NULLIF guard)
 *
 * Fixed UUIDs (hex pattern) per project RLS spec convention — no uuidv7().
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Fixed UUIDs — hex pattern per RLS spec convention
const USER_A_ID = '01912345-6789-7000-8000-aaa000000001';
const USER_B_ID = '01912345-6789-7000-8000-bbb000000001';
const JOB_A_ID = '01912345-6789-7000-8000-aaa000000002';
const JOB_B_ID = '01912345-6789-7000-8000-bbb000000002';

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
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, tenant_id, created_at, updated_at)
       VALUES ('${userId}'::uuid, '${email}', 'RLS Test User', 'active', '${tenantId}'::uuid, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function insertJob(
  prisma: PrismaClient,
  jobId: string,
  tenantId: string,
  userId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO privacy_export_jobs
        (id, tenant_id, user_id, format, status, all_tenant_ids, requested_at, created_at)
      VALUES (
        '${jobId}'::uuid,
        '${tenantId}'::uuid,
        '${userId}'::uuid,
        'json',
        'accepted',
        ARRAY['${tenantId}']::uuid[],
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `);
  });
}

async function countJobsForTenant(
  prisma: PrismaClient,
  tenantId: string,
  jobId: string,
): Promise<number> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM privacy_export_jobs WHERE id = '${jobId}'::uuid`,
    );
  });
  return Number(rows[0]?.count ?? 0);
}

async function countJobsWithoutTenant(prisma: PrismaClient, jobId: string): Promise<number> {
  // No SET LOCAL — NULLIF guard should return 0 rows
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM privacy_export_jobs WHERE id = '${jobId}'::uuid`,
  );
  return Number(rows[0]?.count ?? 0);
}

describe('privacy_export_jobs RLS', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = makeClient();
    await ensureTenant(prisma, TENANT_A_ID, 'Igreja Alpha (Privacy RLS Test)');
    await ensureTenant(prisma, TENANT_B_ID, 'Igreja Beta (Privacy RLS Test)');
    await ensureUser(prisma, USER_A_ID, `rls-privacy-a@test.com`, TENANT_A_ID);
    await ensureUser(prisma, USER_B_ID, `rls-privacy-b@test.com`, TENANT_B_ID);
    await insertJob(prisma, JOB_A_ID, TENANT_A_ID, USER_A_ID);
    await insertJob(prisma, JOB_B_ID, TENANT_B_ID, USER_B_ID);
  });

  afterAll(async () => {
    // Cleanup — delete jobs with superuser context (bypass RLS)
    await prisma.$executeRawUnsafe(
      `DELETE FROM privacy_export_jobs WHERE id IN ('${JOB_A_ID}'::uuid, '${JOB_B_ID}'::uuid)`,
    );
    await prisma.$disconnect();
  });

  it('tenant A sees only its own job', async () => {
    const countA = await countJobsForTenant(prisma, TENANT_A_ID, JOB_A_ID);
    const countB = await countJobsForTenant(prisma, TENANT_A_ID, JOB_B_ID);
    expect(countA).toBe(1);
    expect(countB).toBe(0);
  });

  it('tenant B sees only its own job', async () => {
    const countA = await countJobsForTenant(prisma, TENANT_B_ID, JOB_A_ID);
    const countB = await countJobsForTenant(prisma, TENANT_B_ID, JOB_B_ID);
    expect(countA).toBe(0);
    expect(countB).toBe(1);
  });

  it('SELECT without tenant context returns 0 rows (NULLIF guard)', async () => {
    const countA = await countJobsWithoutTenant(prisma, JOB_A_ID);
    const countB = await countJobsWithoutTenant(prisma, JOB_B_ID);
    expect(countA).toBe(0);
    expect(countB).toBe(0);
  });
});
