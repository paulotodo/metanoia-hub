import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Unique-per-spec fixed UUIDs to avoid collisions when CI runs specs in parallel
const TRAIL_A_ID = '01975700-0001-7000-8000-000000000a01';
const TRAIL_B_ID = '01975700-0001-7000-8000-000000000b01';

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

async function ensureUser(prisma: PrismaClient, userId: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, updated_at)
     VALUES ('${userId}'::uuid, 'trail-rls-${userId}@test.com', 'Trail RLS User', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function seedTrail(
  prisma: PrismaClient,
  tenantId: string,
  trailId: string,
  name: string,
  createdBy: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, name, status, created_by, updated_at)
       VALUES ('${trailId}'::uuid, '${tenantId}'::uuid, '${name}', 'draft', '${createdBy}'::uuid, now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function readTrails(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.trail.findMany();
  });
}

async function cleanupTrails(prisma: PrismaClient, ids: string[]) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      for (const id of ids) {
        await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${id}'::uuid`);
      }
    });
  }
}

describe('RLS Isolation: trails table', () => {
  let prisma: PrismaClient;
  const USER_A = '01975700-0001-7000-8000-000000000a99';
  const USER_B = '01975700-0001-7000-8000-000000000b99';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, USER_A);
    await ensureUser(prisma, USER_B);
  });

  beforeEach(async () => {
    await cleanupTrails(prisma, [TRAIL_A_ID, TRAIL_B_ID]);
  });

  afterAll(async () => {
    await cleanupTrails(prisma, [TRAIL_A_ID, TRAIL_B_ID]);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B trails', async () => {
    await seedTrail(prisma, TENANT_A_ID, TRAIL_A_ID, 'rls-trail-a', USER_A);
    await seedTrail(prisma, TENANT_B_ID, TRAIL_B_ID, 'rls-trail-b', USER_B);

    const visibleToA = await readTrails(prisma, TENANT_A_ID);
    const ids = visibleToA.map((t) => t.id);
    expect(ids).toContain(TRAIL_A_ID);
    expect(ids).not.toContain(TRAIL_B_ID);
  });

  it('tenant B cannot see tenant A trails', async () => {
    await seedTrail(prisma, TENANT_A_ID, TRAIL_A_ID, 'rls-trail-a', USER_A);
    await seedTrail(prisma, TENANT_B_ID, TRAIL_B_ID, 'rls-trail-b', USER_B);

    const visibleToB = await readTrails(prisma, TENANT_B_ID);
    const ids = visibleToB.map((t) => t.id);
    expect(ids).toContain(TRAIL_B_ID);
    expect(ids).not.toContain(TRAIL_A_ID);
  });

  it('empty tenant context returns no trails', async () => {
    await seedTrail(prisma, TENANT_A_ID, TRAIL_A_ID, 'rls-trail-a', USER_A);
    const visible = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.trail.findMany();
    });
    expect(visible.map((t) => t.id)).not.toContain(TRAIL_A_ID);
  });
});
