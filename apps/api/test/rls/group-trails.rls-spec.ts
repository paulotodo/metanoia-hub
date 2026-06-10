import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ---------------------------------------------------------------------------
// Fixed UUIDs — must be unique across all RLS specs
// ---------------------------------------------------------------------------
const TRAIL_A_ID      = '01975704-0001-7000-8000-000000004a01';
const TRAIL_B_ID      = '01975704-0001-7000-8000-000000004b01';
const GROUP_A_ID      = '01975704-0001-7000-8000-000000004a02';
const GROUP_B_ID      = '01975704-0001-7000-8000-000000004b02';
const GROUP_TRAIL_A_ID = '01975704-0001-7000-8000-000000004a10';
const GROUP_TRAIL_B_ID = '01975704-0001-7000-8000-000000004b10';
const USER_A          = '01975704-0001-7000-8000-000000004a99';
const USER_B          = '01975704-0001-7000-8000-000000004b99';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
     VALUES ('${userId}'::uuid, 'gt-rls-${label}@test.com', 'GroupTrail RLS User', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function seedTrail(
  prisma: PrismaClient,
  tenantId: string,
  trailId: string,
  userId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, name, status, created_by, updated_at)
       VALUES ('${trailId}'::uuid, '${tenantId}'::uuid, 'gt-rls-trail', 'published', '${userId}'::uuid, now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedGroup(
  prisma: PrismaClient,
  tenantId: string,
  groupId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
       VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, 'gt-rls-group', 'segunda', '10:00', 'weekly', now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedGroupTrail(
  prisma: PrismaClient,
  tenantId: string,
  gtId: string,
  groupId: string,
  trailId: string,
  assignedBy: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO group_trails (id, tenant_id, group_id, trail_id, assigned_by)
       VALUES (
         '${gtId}'::uuid,
         '${tenantId}'::uuid,
         '${groupId}'::uuid,
         '${trailId}'::uuid,
         '${assignedBy}'::uuid
       )
       ON CONFLICT (group_id, trail_id) DO NOTHING`,
    );
  });
}

async function readGroupTrails(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.groupTrail.findMany();
  });
}

async function cleanupGroupTrails(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(
        `DELETE FROM group_trails WHERE id IN ('${GROUP_TRAIL_A_ID}'::uuid, '${GROUP_TRAIL_B_ID}'::uuid)`,
      );
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RLS Isolation: group_trails table', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, USER_A, 'a');
    await ensureUser(prisma, USER_B, 'b');

    // Seed stable FK chain: tenant→trail+group — torn down in afterAll
    await seedTrail(prisma, TENANT_A_ID, TRAIL_A_ID, USER_A);
    await seedTrail(prisma, TENANT_B_ID, TRAIL_B_ID, USER_B);
    await seedGroup(prisma, TENANT_A_ID, GROUP_A_ID);
    await seedGroup(prisma, TENANT_B_ID, GROUP_B_ID);
  });

  beforeEach(() => cleanupGroupTrails(prisma));

  afterAll(async () => {
    await cleanupGroupTrails(prisma);
    for (const [tenantId, groupId, trailId] of [
      [TENANT_A_ID, GROUP_A_ID, TRAIL_A_ID],
      [TENANT_B_ID, GROUP_B_ID, TRAIL_B_ID],
    ]) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
        await tx.$executeRawUnsafe(`DELETE FROM groups WHERE id = '${groupId}'::uuid`);
        await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${trailId}'::uuid`);
      });
    }
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B group_trails', async () => {
    await seedGroupTrail(prisma, TENANT_A_ID, GROUP_TRAIL_A_ID, GROUP_A_ID, TRAIL_A_ID, USER_A);
    await seedGroupTrail(prisma, TENANT_B_ID, GROUP_TRAIL_B_ID, GROUP_B_ID, TRAIL_B_ID, USER_B);

    const visibleToA = await readGroupTrails(prisma, TENANT_A_ID);
    const ids = visibleToA.map((gt) => gt.id);

    expect(ids).toContain(GROUP_TRAIL_A_ID);
    expect(ids).not.toContain(GROUP_TRAIL_B_ID);
  });

  it('tenant B cannot see tenant A group_trails', async () => {
    await seedGroupTrail(prisma, TENANT_A_ID, GROUP_TRAIL_A_ID, GROUP_A_ID, TRAIL_A_ID, USER_A);
    await seedGroupTrail(prisma, TENANT_B_ID, GROUP_TRAIL_B_ID, GROUP_B_ID, TRAIL_B_ID, USER_B);

    const visibleToB = await readGroupTrails(prisma, TENANT_B_ID);
    const ids = visibleToB.map((gt) => gt.id);

    expect(ids).toContain(GROUP_TRAIL_B_ID);
    expect(ids).not.toContain(GROUP_TRAIL_A_ID);
  });

  it('NULLIF invariant: empty tenant context returns no group_trails', async () => {
    await seedGroupTrail(prisma, TENANT_A_ID, GROUP_TRAIL_A_ID, GROUP_A_ID, TRAIL_A_ID, USER_A);

    const visible = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.groupTrail.findMany();
    });

    expect(visible.map((gt) => gt.id)).not.toContain(GROUP_TRAIL_A_ID);
  });
});
