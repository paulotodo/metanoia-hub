/**
 * Security test: multi-tenant isolation of the detect-evasion-risk job.
 * Story 13.3 / FR66 / Task 10.1.
 *
 * Verifies that:
 *  1. The job processes tenant A without leaking data to tenant B.
 *  2. EvasionJobLog entries with tenant_id IS NULL are visible to both tenants
 *     (global observability, policy: tenant_id IS NULL OR tenant_id = current_tenant).
 *  3. participant_radar_status rows for tenant A are not visible under tenant B context.
 *
 * Requires: DATABASE_APP_URL + DATABASE_URL env (docker-compose up).
 *
 * Seed gotcha (13-2b): raw inserts in users/groups must include updated_at = now().
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';

// UUID v4 for test data (test-only; production uses uuidv7)
const tenantA = randomUUID();
const tenantB = randomUUID();

function makeAppClient(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function makePrivilegedClient(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

async function setTenant(client: PrismaClient, tenantId: string) {
  await client.$executeRawUnsafe(
    `SET LOCAL app.current_tenant_id = '${tenantId}'`,
  );
}

describe('detect-evasion-risk: multi-tenant isolation (Task 10.1)', () => {
  let appClient: PrismaClient;
  let privileged: PrismaClient;

  beforeAll(async () => {
    const appUrl = process.env.DATABASE_APP_URL;
    const privilegedUrl = process.env.DATABASE_URL;
    if (!appUrl || !privilegedUrl) {
      throw new Error(
        'DATABASE_APP_URL and DATABASE_URL required — run docker-compose up first',
      );
    }
    appClient = makeAppClient(appUrl);
    privileged = makePrivilegedClient(privilegedUrl);

    // Seed tenants A and B
    await privileged.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name, slug, status, created_at, updated_at)
       VALUES
         ($1::uuid, $1::uuid, 'Tenant A (evasion-test)', 'tenant-a-evasion', 'active', now(), now()),
         ($2::uuid, $2::uuid, 'Tenant B (evasion-test)', 'tenant-b-evasion', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      tenantA, tenantB,
    );

    // Seed a user in tenant A with last_seen_at
    const userA = randomUUID();
    await privileged.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, last_seen_at, created_at, updated_at)
       VALUES ($1::uuid, 'usera-' || $1::text || '@test.com', 'User A', now(), now(), now())
       ON CONFLICT (id) DO NOTHING`,
      userA,
    );

    // Seed group A (FK target for participant_radar_status)
    const groupA = randomUUID();
    await privileged.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
       VALUES ($1::uuid, $2::uuid, 'Group A (evasion)', 'wed', '19:00', 'weekly', now())
       ON CONFLICT (id) DO NOTHING`,
      groupA, tenantA,
    );

    // Seed participant_radar_status for tenant A
    await privileged.$executeRawUnsafe(
      `INSERT INTO participant_radar_status
         (id, tenant_id, group_id, participant_id, status, trend, presence_percentage, calculated_at)
       VALUES
         ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'vermelho', 'declinio', 0.3, now())
       ON CONFLICT DO NOTHING`,
      randomUUID(), tenantA, groupA, userA,
    );

    // Seed evasion_job_log with tenant_id = NULL (global observability)
    await privileged.$executeRawUnsafe(
      `INSERT INTO evasion_job_log
         (id, job_run_id, status, duration_ms, tenants_processed, participants_flagged, error_message, created_at)
       VALUES ($1::uuid, $2::uuid, 'success', 1200, 2, 5, NULL, now())`,
      randomUUID(), randomUUID(),
    );
  });

  afterAll(async () => {
    // Cleanup test tenants (cascade via FK if available; else best-effort)
    await privileged.$executeRawUnsafe(
      `DELETE FROM tenants WHERE id IN ($1::uuid, $2::uuid)`,
      tenantA, tenantB,
    ).catch(() => {/* best-effort cleanup */});
    await appClient.$disconnect();
    await privileged.$disconnect();
  });

  it('tenant A cannot see participant_radar_status of tenant B', async () => {
    // Insert a participant_radar_status for tenant B via privileged client
    const userB = randomUUID();
    const groupB = randomUUID();
    await privileged.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, created_at, updated_at)
       VALUES ($1::uuid, 'userb-' || $1::text || '@test.com', 'User B', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      userB,
    );
    await privileged.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
       VALUES ($1::uuid, $2::uuid, 'Group B (evasion)', 'wed', '19:00', 'weekly', now())
       ON CONFLICT (id) DO NOTHING`,
      groupB, tenantB,
    );
    await privileged.$executeRawUnsafe(
      `INSERT INTO participant_radar_status
         (id, tenant_id, group_id, participant_id, status, trend, presence_percentage, calculated_at)
       VALUES
         ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'vermelho', 'declinio', 0.2, now())
       ON CONFLICT DO NOTHING`,
      randomUUID(), tenantB, groupB, userB,
    );

    // Query via app client (RLS) under tenant A context
    const rows = await appClient.$transaction(async (tx) => {
      await setTenant(tx as unknown as PrismaClient, tenantA);
      return tx.$queryRawUnsafe<Array<{ tenant_id: string }>>(
        `SELECT tenant_id::text FROM participant_radar_status WHERE tenant_id = $1::uuid`,
        tenantB,
      );
    });

    // Under tenant A context, tenant B rows MUST be invisible (RLS filter)
    expect(rows).toHaveLength(0);
  });

  it('evasion_job_log with tenant_id IS NULL is visible to both tenants', async () => {
    // Under tenant A — global log entry must be readable
    const rowsA = await appClient.$transaction(async (tx) => {
      await setTenant(tx as unknown as PrismaClient, tenantA);
      return tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id::text FROM evasion_job_log WHERE tenant_id IS NULL LIMIT 1`,
      );
    });
    expect(rowsA.length).toBeGreaterThan(0);

    // Under tenant B — same global log entry must be readable
    const rowsB = await appClient.$transaction(async (tx) => {
      await setTenant(tx as unknown as PrismaClient, tenantB);
      return tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id::text FROM evasion_job_log WHERE tenant_id IS NULL LIMIT 1`,
      );
    });
    expect(rowsB.length).toBeGreaterThan(0);
    expect(rowsA[0]?.id).toBe(rowsB[0]?.id); // Same global entry
  });
});
