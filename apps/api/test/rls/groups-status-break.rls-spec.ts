/**
 * RLS isolation tests for `groups.status` + `groups.break_until` (Story 13.3 / FR66-05).
 *
 * Verifies the new recesso columns inherit the existing tenant isolation policy
 * on the `groups` table:
 *  1. Tenant A reads only its own group status/break_until (not Tenant B's)
 *  2. Tenant A UPDATE of status/break_until cannot touch Tenant B rows
 *
 * NOTE: requires a running Postgres (DATABASE_APP_URL) — executed in CI RLS step.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

const GROUP_A_NAME = `recesso-rls-a-${Date.now()}`;
const GROUP_B_NAME = `recesso-rls-b-${Date.now()}`;

function makeClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_APP_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name, created_at, updated_at)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function seedGroupOnBreak(
  prisma: PrismaClient,
  tenantId: string,
  name: string,
): Promise<string> {
  const id = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    // updated_at is @updatedAt NOT NULL without DB default — supply NOW() (lesson 13-2b).
    await tx.$executeRawUnsafe(
      `INSERT INTO groups
         (id, tenant_id, name, day_of_week, time, recurrence, status, break_until, created_at, updated_at)
       VALUES ('${id}'::uuid, '${tenantId}'::uuid, '${name}', 'wed', '19:30', 'weekly',
               'on_break', NOW() + INTERVAL '14 days', NOW(), NOW())`,
    );
  });
  return id;
}

describe('groups.status / break_until RLS', () => {
  let prisma: PrismaClient;
  let groupAId: string;
  let groupBId: string;

  beforeAll(async () => {
    prisma = makeClient();
    await ensureTenant(prisma, TENANT_A_ID, 'Igreja Alpha (RLS Test)');
    await ensureTenant(prisma, TENANT_B_ID, 'Igreja Beta (RLS Test)');
    groupAId = await seedGroupOnBreak(prisma, TENANT_A_ID, GROUP_A_NAME);
    groupBId = await seedGroupOnBreak(prisma, TENANT_B_ID, GROUP_B_NAME);
  });

  afterAll(async () => {
    for (const [tenantId, id] of [
      [TENANT_A_ID, groupAId],
      [TENANT_B_ID, groupBId],
    ] as const) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
        await tx.$executeRawUnsafe(`DELETE FROM groups WHERE id = '${id}'::uuid`);
      });
    }
    await prisma.$disconnect();
  });

  it('Tenant A reads only its own group status/break_until', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRawUnsafe<{ id: string; status: string; break_until: Date | null }[]>(
        `SELECT id::text, status, break_until FROM groups
         WHERE id IN ('${groupAId}'::uuid, '${groupBId}'::uuid)`,
      );
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(groupAId);
    expect(rows[0]?.status).toBe('on_break');
    expect(rows[0]?.break_until).not.toBeNull();
  });

  it('Tenant A UPDATE of status cannot touch Tenant B group', async () => {
    const affected = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$executeRawUnsafe(
        `UPDATE groups SET status = 'active', break_until = NULL WHERE id = '${groupBId}'::uuid`,
      );
    });
    expect(affected).toBe(0); // RLS hides Tenant B's group from Tenant A
  });

  it('SELECT without app.current_tenant_id returns 0 rows (NULLIF guard)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.$queryRawUnsafe<{ count: string }[]>(
        `SELECT COUNT(*)::text as count FROM groups
         WHERE id IN ('${groupAId}'::uuid, '${groupBId}'::uuid)`,
      );
    });
    expect(Number(rows[0]?.count)).toBe(0);
  });
});
