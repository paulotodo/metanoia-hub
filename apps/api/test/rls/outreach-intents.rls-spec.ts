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

async function seedOutreachIntent(
  prisma: PrismaClient,
  tenantId: string,
  note: string,
) {
  const id = generateId();
  const createdByUserId = generateId();
  const targetLeaderId = generateId();
  const weekOf = new Date('2026-04-13T00:00:00Z');

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantId}'`,
    );
    await tx.outreachIntent.create({
      data: {
        id,
        tenantId,
        createdByUserId,
        targetLeaderId,
        weekOf,
        note,
      },
    });
  });

  return { id, tenantId, note };
}

async function readOutreachIntents(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.outreachIntent.findMany();
  });
}

async function cleanupOutreachIntents(prisma: PrismaClient, notes: string[]) {
  const list = notes.map((n) => `'${n}'`).join(',');
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM outreach_intents WHERE note IN (${list})`,
      );
    });
  }
}

describe('RLS Isolation: outreach_intents table', () => {
  let prisma: PrismaClient;
  const noteA = 'rls-outreach-tenant-a';
  const noteB = 'rls-outreach-tenant-b';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B');
  });

  beforeEach(async () => {
    await cleanupOutreachIntents(prisma, [noteA, noteB]);
  });

  afterAll(async () => {
    await cleanupOutreachIntents(prisma, [noteA, noteB]);
    await prisma.$disconnect();
  });

  it('tenant A cannot see tenant B outreach intents', async () => {
    await seedOutreachIntent(prisma, TENANT_A_ID, noteA);
    await seedOutreachIntent(prisma, TENANT_B_ID, noteB);

    const visibleToA = await readOutreachIntents(prisma, TENANT_A_ID);
    expect(visibleToA.some((i) => i.note === noteA)).toBe(true);
    expect(visibleToA.some((i) => i.note === noteB)).toBe(false);
  });

  it('tenant B cannot see tenant A outreach intents', async () => {
    await seedOutreachIntent(prisma, TENANT_A_ID, noteA);
    await seedOutreachIntent(prisma, TENANT_B_ID, noteB);

    const visibleToB = await readOutreachIntents(prisma, TENANT_B_ID);
    expect(visibleToB.some((i) => i.note === noteB)).toBe(true);
    expect(visibleToB.some((i) => i.note === noteA)).toBe(false);
  });
});
