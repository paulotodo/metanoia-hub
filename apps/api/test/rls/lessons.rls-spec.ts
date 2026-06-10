import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

const TRAIL_A_ID = '01975702-0001-7000-8000-000000000a01';
const TRAIL_B_ID = '01975702-0001-7000-8000-000000000b01';
const MODULE_A_ID = '01975702-0001-7000-8000-000000000a02';
const MODULE_B_ID = '01975702-0001-7000-8000-000000000b02';
const LESSON_A_ID = '01975702-0001-7000-8000-000000000a03';
const LESSON_B_ID = '01975702-0001-7000-8000-000000000b03';
const USER_A = '01975702-0001-7000-8000-000000000a99';
const USER_B = '01975702-0001-7000-8000-000000000b99';

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

async function ensureUser(prisma: PrismaClient, userId: string, label: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, updated_at)
     VALUES ('${userId}'::uuid, 'lesson-rls-${label}@test.com', 'Lesson RLS User', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function seedAll(
  prisma: PrismaClient,
  tenantId: string,
  trailId: string,
  moduleId: string,
  lessonId: string,
  userId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, name, status, created_by, updated_at)
       VALUES ('${trailId}'::uuid, '${tenantId}'::uuid, 'trail-for-lesson-rls', 'draft', '${userId}'::uuid, now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO modules (id, tenant_id, trail_id, name, "order", updated_at)
       VALUES ('${moduleId}'::uuid, '${tenantId}'::uuid, '${trailId}'::uuid, 'mod-for-lesson-rls', 0, now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO lessons (id, tenant_id, module_id, name, content_type, "order", updated_at)
       VALUES ('${lessonId}'::uuid, '${tenantId}'::uuid, '${moduleId}'::uuid, 'lesson-rls-test', 'video', 0, now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function readLessons(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.lesson.findMany();
  });
}

async function cleanup(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      for (const id of [LESSON_A_ID, LESSON_B_ID]) {
        await tx.$executeRawUnsafe(`DELETE FROM lessons WHERE id = '${id}'::uuid`);
      }
      for (const id of [MODULE_A_ID, MODULE_B_ID]) {
        await tx.$executeRawUnsafe(`DELETE FROM modules WHERE id = '${id}'::uuid`);
      }
      for (const id of [TRAIL_A_ID, TRAIL_B_ID]) {
        await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${id}'::uuid`);
      }
    });
  }
}

describe('RLS Isolation: lessons table', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    await prisma.$connect();
    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, USER_A, 'a');
    await ensureUser(prisma, USER_B, 'b');
  });

  beforeEach(cleanup.bind(null, prisma));
  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B lessons', async () => {
    await seedAll(prisma, TENANT_A_ID, TRAIL_A_ID, MODULE_A_ID, LESSON_A_ID, USER_A);
    await seedAll(prisma, TENANT_B_ID, TRAIL_B_ID, MODULE_B_ID, LESSON_B_ID, USER_B);

    const visibleToA = await readLessons(prisma, TENANT_A_ID);
    const ids = visibleToA.map((l) => l.id);
    expect(ids).toContain(LESSON_A_ID);
    expect(ids).not.toContain(LESSON_B_ID);
  });

  it('tenant B cannot see tenant A lessons', async () => {
    await seedAll(prisma, TENANT_A_ID, TRAIL_A_ID, MODULE_A_ID, LESSON_A_ID, USER_A);
    await seedAll(prisma, TENANT_B_ID, TRAIL_B_ID, MODULE_B_ID, LESSON_B_ID, USER_B);

    const visibleToB = await readLessons(prisma, TENANT_B_ID);
    const ids = visibleToB.map((l) => l.id);
    expect(ids).toContain(LESSON_B_ID);
    expect(ids).not.toContain(LESSON_A_ID);
  });
});
