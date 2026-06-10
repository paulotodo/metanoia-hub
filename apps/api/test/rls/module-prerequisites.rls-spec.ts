import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ---------------------------------------------------------------------------
// Fixed UUIDs (must be unique across all RLS specs)
// ---------------------------------------------------------------------------
const TRAIL_A_ID  = '01975702-0001-7000-8000-000000001a01';
const TRAIL_B_ID  = '01975702-0001-7000-8000-000000001b01';
const MOD_A1_ID   = '01975702-0001-7000-8000-000000001a02';
const MOD_A2_ID   = '01975702-0001-7000-8000-000000001a03';
const MOD_B1_ID   = '01975702-0001-7000-8000-000000001b02';
const MOD_B2_ID   = '01975702-0001-7000-8000-000000001b03';
const USER_A      = '01975702-0001-7000-8000-000000001a99';
const USER_B      = '01975702-0001-7000-8000-000000001b99';

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
     VALUES ('${userId}'::uuid, 'prereq-rls-${label}@test.com', 'Prereq RLS User', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function seedChain(
  prisma: PrismaClient,
  tenantId: string,
  trailId: string,
  mod1Id: string,
  mod2Id: string,
  userId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, name, status, created_by, updated_at)
       VALUES ('${trailId}'::uuid, '${tenantId}'::uuid, 'prereq-rls-trail', 'draft', '${userId}'::uuid, now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO modules (id, tenant_id, trail_id, name, "order", updated_at)
       VALUES ('${mod1Id}'::uuid, '${tenantId}'::uuid, '${trailId}'::uuid, 'mod-rls-1', 0, now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO modules (id, tenant_id, trail_id, name, "order", updated_at)
       VALUES ('${mod2Id}'::uuid, '${tenantId}'::uuid, '${trailId}'::uuid, 'mod-rls-2', 1, now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedPrerequisite(
  prisma: PrismaClient,
  tenantId: string,
  moduleId: string,
  prerequisiteModuleId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO module_prerequisites (tenant_id, module_id, prerequisite_module_id)
       VALUES ('${tenantId}'::uuid, '${moduleId}'::uuid, '${prerequisiteModuleId}'::uuid)
       ON CONFLICT (module_id, prerequisite_module_id) DO NOTHING`,
    );
  });
}

async function readPrerequisites(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.modulePrerequisite.findMany();
  });
}

async function cleanupPrerequisites(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(`DELETE FROM module_prerequisites WHERE tenant_id = '${tenantId}'::uuid`);
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RLS Isolation: module_prerequisites table', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, USER_A, 'a');
    await ensureUser(prisma, USER_B, 'b');

    // Seed the module chains (trail→module→module) for both tenants
    await seedChain(prisma, TENANT_A_ID, TRAIL_A_ID, MOD_A1_ID, MOD_A2_ID, USER_A);
    await seedChain(prisma, TENANT_B_ID, TRAIL_B_ID, MOD_B1_ID, MOD_B2_ID, USER_B);
  });

  beforeEach(() => cleanupPrerequisites(prisma));

  afterAll(async () => {
    await cleanupPrerequisites(prisma);
    // Cleanup modules and trails (FK cascade handles prerequisites)
    for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
        for (const id of [MOD_A1_ID, MOD_A2_ID, MOD_B1_ID, MOD_B2_ID]) {
          await tx.$executeRawUnsafe(`DELETE FROM modules WHERE id = '${id}'::uuid`);
        }
        for (const id of [TRAIL_A_ID, TRAIL_B_ID]) {
          await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${id}'::uuid`);
        }
      });
    }
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B prerequisites', async () => {
    await seedPrerequisite(prisma, TENANT_A_ID, MOD_A2_ID, MOD_A1_ID);
    await seedPrerequisite(prisma, TENANT_B_ID, MOD_B2_ID, MOD_B1_ID);

    const visibleToA = await readPrerequisites(prisma, TENANT_A_ID);
    const moduleIds = visibleToA.map((r) => r.moduleId);

    expect(moduleIds).toContain(MOD_A2_ID);
    expect(moduleIds).not.toContain(MOD_B2_ID);
  });

  it('tenant B cannot see tenant A prerequisites', async () => {
    await seedPrerequisite(prisma, TENANT_A_ID, MOD_A2_ID, MOD_A1_ID);
    await seedPrerequisite(prisma, TENANT_B_ID, MOD_B2_ID, MOD_B1_ID);

    const visibleToB = await readPrerequisites(prisma, TENANT_B_ID);
    const moduleIds = visibleToB.map((r) => r.moduleId);

    expect(moduleIds).toContain(MOD_B2_ID);
    expect(moduleIds).not.toContain(MOD_A2_ID);
  });

  it('NULLIF invariant: empty tenant_id setting returns no rows', async () => {
    await seedPrerequisite(prisma, TENANT_A_ID, MOD_A2_ID, MOD_A1_ID);

    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.modulePrerequisite.findMany();
    });

    expect(rows).toHaveLength(0);
  });
});
