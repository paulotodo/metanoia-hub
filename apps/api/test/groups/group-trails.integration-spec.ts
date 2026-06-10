/**
 * Integration tests for Story 4-4 — group trails association flow.
 *
 * Tests the service layer directly against a real Postgres database (no HTTP).
 * Assumes DATABASE_APP_URL is set and migrations are applied (docker-compose.test.yml).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { requestContext } from '../../src/common/context/request-context';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GroupTrailsRepository } from '../../src/groups/trails/group-trails.repository';
import { GroupTrailsService } from '../../src/groups/trails/group-trails.service';

// ---------------------------------------------------------------------------
// Fixed seed UUIDs — unique across all integration specs
// ---------------------------------------------------------------------------
const TENANT_ID = '019756c0-4400-7000-8000-000000000001';
const USER_ID   = '019756c0-4400-7000-8000-000000000002';
const GROUP_ID  = '019756c0-4400-7000-8000-000000000003';
const TRAIL_1   = '019756c0-4400-7000-8000-000000000010';
const TRAIL_2   = '019756c0-4400-7000-8000-000000000011';
const TRAIL_GHOST = '019756c0-4400-7000-8000-000000000099'; // will NOT be seeded

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function withContext<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestContext.run(
      { tenantId: TENANT_ID, userId: USER_ID, requestId: 'req-it', correlationId: 'corr-it' },
      () => fn().then(resolve).catch(reject),
    );
  });
}

async function seedTenant(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_ID}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name)
       VALUES ('${TENANT_ID}'::uuid, '${TENANT_ID}'::uuid, 'trails-int-test')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedUser(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, updated_at)
     VALUES ('${USER_ID}'::uuid, 'gtrails-int@test.com', 'Group Trails Test', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function seedGroup(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_ID}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
       VALUES ('${GROUP_ID}'::uuid, '${TENANT_ID}'::uuid, 'Grupo Teste', 'segunda', '10:00', 'weekly', now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedTrail(prisma: PrismaClient, trailId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_ID}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, name, status, created_by, updated_at)
       VALUES ('${trailId}'::uuid, '${TENANT_ID}'::uuid, '${name}', 'published', '${USER_ID}'::uuid, now())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function cleanupGroupTrails(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_ID}'`);
    await tx.$executeRawUnsafe(
      `DELETE FROM group_trails WHERE group_id = '${GROUP_ID}'::uuid`,
    );
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('GroupTrails integration — associate/unassign flow', () => {
  let prisma: PrismaClient;
  let service: GroupTrailsService;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL;
    if (!connectionString) throw new Error('DATABASE_APP_URL missing');
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    await prisma.$connect();

    // Build service without full NestJS DI
    const prismaService = { client: prisma } as PrismaService;
    const repo = new GroupTrailsRepository(prismaService);
    service = new GroupTrailsService(repo);

    await seedTenant(prisma);
    await seedUser(prisma);
    await seedGroup(prisma);
    await seedTrail(prisma, TRAIL_1, 'Trilha Discipulado');
    await seedTrail(prisma, TRAIL_2, 'Trilha Evangelismo');
  });

  beforeEach(() => cleanupGroupTrails(prisma));

  afterAll(async () => {
    await cleanupGroupTrails(prisma);
    // Tear down FK chain in reverse order
    for (const trailId of [TRAIL_1, TRAIL_2]) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_ID}'`);
        await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${trailId}'::uuid`);
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_ID}'`);
      await tx.$executeRawUnsafe(`DELETE FROM groups WHERE id = '${GROUP_ID}'::uuid`);
    });
    await prisma.$disconnect();
  });

  // -------------------------------------------------------------------------

  it('bulk-assigns trails and returns 201 shape', async () => {
    const result = await withContext(() =>
      service.associateTrails(GROUP_ID, [TRAIL_1, TRAIL_2]),
    );

    expect(result.meta.created).toBe(2);
    expect(result.data).toHaveLength(2);
    const trailIds = result.data.map((r) => r.trailId);
    expect(trailIds).toContain(TRAIL_1);
    expect(trailIds).toContain(TRAIL_2);
    // Response shape validation
    for (const item of result.data) {
      expect(item.tenantId).toBe(TENANT_ID);
      expect(item.groupId).toBe(GROUP_ID);
      expect(item.assignedBy).toBe(USER_ID);
      expect(item.assignedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('is idempotent — re-associating same trails does not error', async () => {
    await withContext(() => service.associateTrails(GROUP_ID, [TRAIL_1]));
    const result = await withContext(() =>
      service.associateTrails(GROUP_ID, [TRAIL_1]),
    );
    expect(result.meta.created).toBe(1); // returned existing
  });

  it('returns 422 with invalidTrailIds for non-existent trail', async () => {
    const { UnprocessableEntityException } = await import(
      '@nestjs/common'
    );
    await expect(
      withContext(() => service.associateTrails(GROUP_ID, [TRAIL_1, TRAIL_GHOST])),
    ).rejects.toThrow(UnprocessableEntityException);

    try {
      await withContext(() => service.associateTrails(GROUP_ID, [TRAIL_GHOST]));
    } catch (e) {
      const err = e as { getResponse: () => Record<string, unknown> };
      const body = err.getResponse();
      expect(body['statusCode']).toBe(422);
      expect(body['invalidTrailIds']).toContain(TRAIL_GHOST);
    }
  });

  it('lists trails associated with the group', async () => {
    await withContext(() => service.associateTrails(GROUP_ID, [TRAIL_1, TRAIL_2]));
    const list = await withContext(() => service.listTrails(GROUP_ID));

    expect(list.meta.total).toBe(2);
    expect(list.data.map((r) => r.trailId).sort()).toEqual([TRAIL_1, TRAIL_2].sort());
  });

  it('unassigns a trail and confirms deletion', async () => {
    await withContext(() => service.associateTrails(GROUP_ID, [TRAIL_1, TRAIL_2]));
    await withContext(() => service.unassignTrail(GROUP_ID, TRAIL_1));

    const list = await withContext(() => service.listTrails(GROUP_ID));
    expect(list.meta.total).toBe(1);
    expect(list.data[0].trailId).toBe(TRAIL_2);
  });

  it('throws 404 when unassigning a trail not associated', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    await expect(
      withContext(() => service.unassignTrail(GROUP_ID, TRAIL_1)),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists empty array when group has no trails', async () => {
    const list = await withContext(() => service.listTrails(GROUP_ID));
    expect(list.data).toHaveLength(0);
    expect(list.meta.total).toBe(0);
  });
});
