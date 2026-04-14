import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

/**
 * Seeds one invite directly (bypassing RLS via raw SQL so we can set tenant_id
 * to NULL — the pre-tenant case the policy must allow).
 */
async function seedInvite(
  prisma: PrismaClient,
  tenantId: string | null,
  token: string,
) {
  const id = generateId();
  const expiresAt = new Date(Date.now() + 86_400_000);
  const ctx = tenantId ?? TENANT_A_ID;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${ctx}'`,
    );
    if (tenantId === null) {
      await tx.$executeRawUnsafe(
        `INSERT INTO invites (id, token, tenant_id, leader_name, leader_email, expires_at)
         VALUES ('${id}'::uuid, '${token}', NULL, 'Pre-Tenant Leader', 'pre@example.com', '${expiresAt.toISOString()}')`,
      );
    } else {
      await tx.$executeRawUnsafe(
        `INSERT INTO invites (id, token, tenant_id, leader_name, leader_email, expires_at)
         VALUES ('${id}'::uuid, '${token}', '${tenantId}'::uuid, 'Tenant Leader', 'leader@example.com', '${expiresAt.toISOString()}')`,
      );
    }
  });

  return { id, token, tenantId };
}

async function readInvites(prisma: PrismaClient, tenantCtx: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenantCtx}'`,
    );
    return tx.invite.findMany();
  });
}

async function cleanupInvites(prisma: PrismaClient, tokens: string[]) {
  const list = tokens.map((t) => `'${t}'`).join(',');
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM invites WHERE token IN (${list})`,
      );
    });
  }
}

describe('RLS Isolation: invites table', () => {
  let prisma: PrismaClient;
  const tokenA = 'rls-inv-tenant-a';
  const tokenB = 'rls-inv-tenant-b';
  const tokenPre = 'rls-inv-pre-tenant';

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanupInvites(prisma, [tokenA, tokenB, tokenPre]);
  });

  afterAll(async () => {
    await cleanupInvites(prisma, [tokenA, tokenB, tokenPre]);
    await prisma.$disconnect();
  });

  it('tenant B cannot see tenant A invites, but pre-tenant invite is visible', async () => {
    await seedInvite(prisma, TENANT_A_ID, tokenA);
    await seedInvite(prisma, null, tokenPre);

    const visibleToB = await readInvites(prisma, TENANT_B_ID);

    expect(visibleToB.some((i) => i.token === tokenA)).toBe(false);
    expect(visibleToB.some((i) => i.token === tokenPre)).toBe(true);
  });

  it('tenant A sees its own invite and the pre-tenant invite', async () => {
    await seedInvite(prisma, TENANT_A_ID, tokenA);
    await seedInvite(prisma, TENANT_B_ID, tokenB);
    await seedInvite(prisma, null, tokenPre);

    const visibleToA = await readInvites(prisma, TENANT_A_ID);

    expect(visibleToA.some((i) => i.token === tokenA)).toBe(true);
    expect(visibleToA.some((i) => i.token === tokenPre)).toBe(true);
    expect(visibleToA.some((i) => i.token === tokenB)).toBe(false);
  });
});
