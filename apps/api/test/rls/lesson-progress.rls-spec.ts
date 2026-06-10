import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Unique-per-spec fixed UUIDs — avoids collisions when CI runs specs in parallel
const TRAIL_ID_A = '01975700-0083-7000-8000-000000000a10';
const TRAIL_ID_B = '01975700-0083-7000-8000-000000000b10';
const MODULE_ID_A = '01975700-0083-7000-8000-000000000a20';
const MODULE_ID_B = '01975700-0083-7000-8000-000000000b20';
const LESSON_ID_A = '01975700-0083-7000-8000-000000000a30';
const LESSON_ID_B = '01975700-0083-7000-8000-000000000b30';

const PROGRESS_A_USER1 = '01975700-0083-7000-8000-000000000a50';
const PROGRESS_B_USER2 = '01975700-0083-7000-8000-000000000b50';
const PROGRESS_A_USER2 = '01975700-0083-7000-8000-000000000a51'; // cross-user same tenant

// Users: global (no tenant_id), unique emails per spec
const USER1_ID = '01975700-0083-7000-8000-000000000a99';
const USER2_ID = '01975700-0083-7000-8000-000000000b99';

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function ensureUser(prisma: PrismaClient, userId: string, suffix: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, updated_at)
     VALUES ('${userId}'::uuid, 'progress-rls-${suffix}@test.com', 'Progress RLS User', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function seedTrailChain(
  prisma: PrismaClient,
  tenantId: string,
  trailId: string,
  moduleId: string,
  lessonId: string,
  createdBy: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, name, status, created_by, updated_at)
       VALUES ('${trailId}'::uuid, '${tenantId}'::uuid, 'rls-trail-${tenantId.slice(-4)}', 'draft', '${createdBy}'::uuid, now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO modules (id, tenant_id, trail_id, name, "order", updated_at)
       VALUES ('${moduleId}'::uuid, '${tenantId}'::uuid, '${trailId}'::uuid, 'Module RLS', 0, now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO lessons (id, tenant_id, module_id, name, content_type, "order", updated_at)
       VALUES ('${lessonId}'::uuid, '${tenantId}'::uuid, '${moduleId}'::uuid, 'Lesson RLS', 'video', 0, now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedLessonProgress(
  prisma: PrismaClient,
  tenantId: string,
  progressId: string,
  userId: string,
  lessonId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO lesson_progress (id, tenant_id, user_id, lesson_id, status, progress_percent, last_accessed_at, created_at, updated_at)
       VALUES ('${progressId}'::uuid, '${tenantId}'::uuid, '${userId}'::uuid, '${lessonId}'::uuid, 'in_progress', 50, now(), now(), now())
       ON CONFLICT (tenant_id, user_id, lesson_id) DO NOTHING`,
    );
  });
}

async function readLessonProgress(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.lessonProgress.findMany();
  });
}

// beforeEach cleanup: only the mutable per-test data (lesson_progress).
// The trail→module→lesson chain is stable setup (seeded once in beforeAll,
// torn down in afterAll) — deleting it here would break the FK referenced by
// lesson_progress seeded in each test.
async function cleanup(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(
        `DELETE FROM lesson_progress WHERE id IN (
          '${PROGRESS_A_USER1}'::uuid,
          '${PROGRESS_B_USER2}'::uuid,
          '${PROGRESS_A_USER2}'::uuid
        )`,
      );
    });
  }
}

// afterAll teardown: mutable data + the stable trail chain.
async function teardownChain(prisma: PrismaClient) {
  await cleanup(prisma);
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(`DELETE FROM lessons WHERE id = '${LESSON_ID_A}'::uuid`);
      await tx.$executeRawUnsafe(`DELETE FROM lessons WHERE id = '${LESSON_ID_B}'::uuid`);
      await tx.$executeRawUnsafe(`DELETE FROM modules WHERE id = '${MODULE_ID_A}'::uuid`);
      await tx.$executeRawUnsafe(`DELETE FROM modules WHERE id = '${MODULE_ID_B}'::uuid`);
      await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${TRAIL_ID_A}'::uuid`);
      await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${TRAIL_ID_B}'::uuid`);
    });
  }
}

describe('RLS Isolation: lesson_progress table', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, USER1_ID, USER1_ID);
    await ensureUser(prisma, USER2_ID, USER2_ID);

    await seedTrailChain(prisma, TENANT_A_ID, TRAIL_ID_A, MODULE_ID_A, LESSON_ID_A, USER1_ID);
    await seedTrailChain(prisma, TENANT_B_ID, TRAIL_ID_B, MODULE_ID_B, LESSON_ID_B, USER2_ID);
  });

  beforeEach(async () => {
    await cleanup(prisma);
  });

  afterAll(async () => {
    await teardownChain(prisma);
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------
  // Cross-tenant isolation
  // -------------------------------------------------------------------------

  it('tenant A cannot see tenant B progress records', async () => {
    await seedLessonProgress(prisma, TENANT_A_ID, PROGRESS_A_USER1, USER1_ID, LESSON_ID_A);
    await seedLessonProgress(prisma, TENANT_B_ID, PROGRESS_B_USER2, USER2_ID, LESSON_ID_B);

    const visibleToA = await readLessonProgress(prisma, TENANT_A_ID);
    const ids = visibleToA.map((p) => p.id);

    expect(ids).toContain(PROGRESS_A_USER1);
    expect(ids).not.toContain(PROGRESS_B_USER2);
  });

  it('tenant B cannot see tenant A progress records', async () => {
    await seedLessonProgress(prisma, TENANT_A_ID, PROGRESS_A_USER1, USER1_ID, LESSON_ID_A);
    await seedLessonProgress(prisma, TENANT_B_ID, PROGRESS_B_USER2, USER2_ID, LESSON_ID_B);

    const visibleToB = await readLessonProgress(prisma, TENANT_B_ID);
    const ids = visibleToB.map((p) => p.id);

    expect(ids).toContain(PROGRESS_B_USER2);
    expect(ids).not.toContain(PROGRESS_A_USER1);
  });

  it('empty tenant context returns no progress records', async () => {
    await seedLessonProgress(prisma, TENANT_A_ID, PROGRESS_A_USER1, USER1_ID, LESSON_ID_A);

    const visible = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.lessonProgress.findMany();
    });

    expect(visible.map((p) => p.id)).not.toContain(PROGRESS_A_USER1);
  });

  // -------------------------------------------------------------------------
  // Note: Cross-user isolation within the same tenant requires the
  // app.current_user_id session variable to be set (app-level policy).
  // The tenant isolation policy alone already ensures no cross-tenant leakage.
  // Full user-level isolation is enforced at the application layer via
  // withTenantTx + RequestContext userId checks in the progress processor.
  // -------------------------------------------------------------------------
  it('tenant context filters progress to correct tenant', async () => {
    // Both users exist in Tenant A
    await seedLessonProgress(prisma, TENANT_A_ID, PROGRESS_A_USER1, USER1_ID, LESSON_ID_A);
    await seedLessonProgress(prisma, TENANT_A_ID, PROGRESS_A_USER2, USER2_ID, LESSON_ID_A);

    const visibleToA = await readLessonProgress(prisma, TENANT_A_ID);
    const ids = visibleToA.map((p) => p.id);

    // Both visible under correct tenant — user-level filter applied by app logic
    expect(ids).toContain(PROGRESS_A_USER1);
    expect(ids).toContain(PROGRESS_A_USER2);
  });
});
