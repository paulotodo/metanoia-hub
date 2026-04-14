import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedGroup(prisma: PrismaClient, tenantId: string, name: string) {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.group.create({
      data: {
        id,
        tenantId,
        name,
        dayOfWeek: 'wed',
        time: '19:30',
        recurrence: 'weekly',
        notes: null,
      },
    });
  });
  return { id, tenantId, name };
}

async function readGroups(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.group.findMany();
  });
}

async function cleanupGroups(prisma: PrismaClient, names: string[]) {
  const list = names.map((n) => `'${n}'`).join(',');
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM groups WHERE name IN (${list})`,
      );
    });
  }
}

describe('RLS Isolation: groups table', () => {
  let prisma: PrismaClient;
  const groupAName = 'rls-groups-tenant-a';
  const groupBName = 'rls-groups-tenant-b';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
  });

  beforeEach(async () => {
    await cleanupGroups(prisma, [groupAName, groupBName]);
  });

  afterAll(async () => {
    await cleanupGroups(prisma, [groupAName, groupBName]);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B groups', async () => {
    await seedGroup(prisma, TENANT_A_ID, groupAName);
    await seedGroup(prisma, TENANT_B_ID, groupBName);

    const visibleToA = await readGroups(prisma, TENANT_A_ID);
    expect(visibleToA.some((g) => g.name === groupAName)).toBe(true);
    expect(visibleToA.some((g) => g.name === groupBName)).toBe(false);
  });

  it('tenant B cannot see tenant A groups', async () => {
    await seedGroup(prisma, TENANT_A_ID, groupAName);
    await seedGroup(prisma, TENANT_B_ID, groupBName);

    const visibleToB = await readGroups(prisma, TENANT_B_ID);
    expect(visibleToB.some((g) => g.name === groupBName)).toBe(true);
    expect(visibleToB.some((g) => g.name === groupAName)).toBe(false);
  });
});
