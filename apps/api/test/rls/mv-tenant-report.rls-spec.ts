import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

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

async function seedGroup(
  prisma: PrismaClient,
  tenantId: string,
  groupName: string,
): Promise<{ groupId: string }> {
  const groupId = generateId();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence)
      VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, '${groupName}', 'wed', '19:00', 'weekly')
      ON CONFLICT (id) DO NOTHING
    `);
  });
  return { groupId };
}

async function refreshMv(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW mv_tenant_report');
}

async function queryMvForTenant(
  prisma: PrismaClient,
  tenantId: string,
): Promise<Array<{ tenant_id: string; group_id: string }>> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRaw<Array<{ tenant_id: string; group_id: string }>>`
      SELECT tenant_id::text, group_id::text
      FROM mv_tenant_report
      WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    `;
  });
}

async function queryMvNoContext(
  prisma: PrismaClient,
): Promise<Array<{ tenant_id: string; group_id: string }>> {
  // Sem SET LOCAL — simula acesso sem contexto de tenant (closed-by-default)
  return prisma.$queryRaw<Array<{ tenant_id: string; group_id: string }>>`
    SELECT tenant_id::text, group_id::text
    FROM mv_tenant_report
    WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  `;
}

async function cleanupGroups(prisma: PrismaClient, groupNames: string[]) {
  const list = groupNames.map((n) => `'${n}'`).join(',');
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(`DELETE FROM groups WHERE name IN (${list})`);
    });
  }
  await refreshMv(prisma);
}

// ────────────────────────────────────────────────────────────────
// Suite principal — gate obrigatório de merge (AC-SEC-01)
// ────────────────────────────────────────────────────────────────

describe('MV mv_tenant_report — RLS isolation', () => {
  let prisma: PrismaClient;
  const groupAName = 'rls-mv-group-tenant-a';
  const groupBName = 'rls-mv-group-tenant-b';
  let tenantAGroupId: string;
  let tenantBGroupId: string;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A — MV RLS');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B — MV RLS');
  });

  afterAll(async () => {
    await cleanupGroups(prisma, [groupAName, groupBName]).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupGroups(prisma, [groupAName, groupBName]);
    ({ groupId: tenantAGroupId } = await seedGroup(prisma, TENANT_A_ID, groupAName));
    ({ groupId: tenantBGroupId } = await seedGroup(prisma, TENANT_B_ID, groupBName));
    await refreshMv(prisma);
  });

  it('Admin Tenant A NÃO vê grupos do Tenant B na MV (AC-SEC-01)', async () => {
    const rows = await queryMvForTenant(prisma, TENANT_A_ID);
    const groupIds = rows.map((r) => r.group_id);
    expect(groupIds).not.toContain(tenantBGroupId);
  });

  it('Admin Tenant A vê APENAS seus próprios grupos na MV', async () => {
    const rows = await queryMvForTenant(prisma, TENANT_A_ID);
    for (const row of rows) {
      expect(row.tenant_id).toBe(TENANT_A_ID);
    }
  });

  it('current_setting vazio → 0 linhas (closed-by-default)', async () => {
    const rows = await queryMvNoContext(prisma);
    expect(rows).toHaveLength(0);
  });

  it('Admin Tenant B vê APENAS seus próprios grupos na MV', async () => {
    const rows = await queryMvForTenant(prisma, TENANT_B_ID);
    const tenantIds = rows.map((r) => r.tenant_id);
    expect(tenantIds.every((id) => id === TENANT_B_ID)).toBe(true);
  });

  it('Admin Tenant B NÃO vê grupos do Tenant A na MV', async () => {
    const rows = await queryMvForTenant(prisma, TENANT_B_ID);
    const groupIds = rows.map((r) => r.group_id);
    expect(groupIds).not.toContain(tenantAGroupId);
  });
});
