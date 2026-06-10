import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ---------------------------------------------------------------------------
// Fixed UUIDs — must be unique across all RLS specs
// ---------------------------------------------------------------------------
const TRAIL_A_ID   = '01975703-0001-7000-8000-000000003a01';
const TRAIL_B_ID   = '01975703-0001-7000-8000-000000003b01';
const VERSION_A_ID = '01975703-0001-7000-8000-000000003a10';
const VERSION_B_ID = '01975703-0001-7000-8000-000000003b10';
const USER_A       = '01975703-0001-7000-8000-000000003a99';
const USER_B       = '01975703-0001-7000-8000-000000003b99';

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
     VALUES ('${userId}'::uuid, 'tv-rls-${label}@test.com', 'TrailVersion RLS User', 'active', now())
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
       VALUES ('${trailId}'::uuid, '${tenantId}'::uuid, 'tv-rls-trail', 'draft', '${userId}'::uuid, now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedTrailVersion(
  prisma: PrismaClient,
  tenantId: string,
  versionId: string,
  trailId: string,
  userId: string,
  versionNum: number,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO trail_versions (id, tenant_id, trail_id, version, snapshot_data, published_at, published_by)
       VALUES (
         '${versionId}'::uuid,
         '${tenantId}'::uuid,
         '${trailId}'::uuid,
         ${versionNum},
         '{"version":${versionNum}}'::jsonb,
         now(),
         '${userId}'::uuid
       )
       ON CONFLICT (trail_id, version) DO NOTHING`,
    );
  });
}

async function readVersions(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    return tx.trailVersion.findMany();
  });
}

async function cleanupVersions(prisma: PrismaClient) {
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(
        `DELETE FROM trail_versions WHERE id IN ('${VERSION_A_ID}'::uuid, '${VERSION_B_ID}'::uuid)`,
      );
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RLS Isolation: trail_versions table', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
    await ensureUser(prisma, USER_A, 'a');
    await ensureUser(prisma, USER_B, 'b');

    // Seed stable FK chain (trail) — torn down in afterAll
    await seedTrail(prisma, TENANT_A_ID, TRAIL_A_ID, USER_A);
    await seedTrail(prisma, TENANT_B_ID, TRAIL_B_ID, USER_B);
  });

  beforeEach(() => cleanupVersions(prisma));

  afterAll(async () => {
    await cleanupVersions(prisma);
    for (const [tenantId, trailId] of [
      [TENANT_A_ID, TRAIL_A_ID],
      [TENANT_B_ID, TRAIL_B_ID],
    ]) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
        await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${trailId}'::uuid`);
      });
    }
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B trail versions', async () => {
    await seedTrailVersion(prisma, TENANT_A_ID, VERSION_A_ID, TRAIL_A_ID, USER_A, 1);
    await seedTrailVersion(prisma, TENANT_B_ID, VERSION_B_ID, TRAIL_B_ID, USER_B, 1);

    const visibleToA = await readVersions(prisma, TENANT_A_ID);
    const ids = visibleToA.map((v) => v.id);

    expect(ids).toContain(VERSION_A_ID);
    expect(ids).not.toContain(VERSION_B_ID);
  });

  it('tenant B cannot see tenant A trail versions', async () => {
    await seedTrailVersion(prisma, TENANT_A_ID, VERSION_A_ID, TRAIL_A_ID, USER_A, 1);
    await seedTrailVersion(prisma, TENANT_B_ID, VERSION_B_ID, TRAIL_B_ID, USER_B, 1);

    const visibleToB = await readVersions(prisma, TENANT_B_ID);
    const ids = visibleToB.map((v) => v.id);

    expect(ids).toContain(VERSION_B_ID);
    expect(ids).not.toContain(VERSION_A_ID);
  });

  it('NULLIF invariant: empty tenant context returns no trail versions', async () => {
    await seedTrailVersion(prisma, TENANT_A_ID, VERSION_A_ID, TRAIL_A_ID, USER_A, 1);

    const visible = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.trailVersion.findMany();
    });

    expect(visible.map((v) => v.id)).not.toContain(VERSION_A_ID);
  });
});
