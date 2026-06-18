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
      `INSERT INTO tenants (id, tenant_id, name, updated_at)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}', now())
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
      INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, updated_at)
      VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, '${groupName}', 'wed', '19:00', 'weekly', now())
      ON CONFLICT (id) DO NOTHING
    `);
  });
  return { groupId };
}

// REFRESH requires owner of the MV + bypass-RLS (see all tenants).
// The app role (metanoia_app, NOSUPERUSER) is neither owner nor RLS-bypassing,
// so the refresh MUST run on the SUPERUSER connection (DATABASE_URL).
async function refreshMv(su: PrismaClient) {
  await su.$executeRawUnsafe('REFRESH MATERIALIZED VIEW mv_tenant_report');
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

async function cleanupGroups(
  prisma: PrismaClient,
  su: PrismaClient,
  groupNames: string[],
) {
  const list = groupNames.map((n) => `'${n}'`).join(',');
  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      await tx.$executeRawUnsafe(`DELETE FROM groups WHERE name IN (${list})`);
    });
  }
  await refreshMv(su);
}

// ────────────────────────────────────────────────────────────────
// Suite principal — gate obrigatório de merge (AC-SEC-01)
// ────────────────────────────────────────────────────────────────

describe('MV mv_tenant_report — RLS isolation', () => {
  let prisma: PrismaClient;
  let su: PrismaClient;
  const groupAName = 'rls-mv-group-tenant-a';
  const groupBName = 'rls-mv-group-tenant-b';
  let tenantAGroupId: string;
  let tenantBGroupId: string;

  beforeAll(async () => {
    // App client (metanoia_app, NOSUPERUSER) — exercises RLS on SELECT/INSERT.
    const appConnectionString = process.env.DATABASE_APP_URL!;
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: appConnectionString }) });
    await prisma.$connect();

    // Superuser client (metanoia, DATABASE_URL) — owner of the MV + bypasses RLS,
    // required so REFRESH can rebuild the MV across all tenants.
    const suConnectionString = process.env.DATABASE_URL!;
    su = new PrismaClient({ adapter: new PrismaPg({ connectionString: suConnectionString }) });
    await su.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A — MV RLS');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B — MV RLS');
  });

  afterAll(async () => {
    await cleanupGroups(prisma, su, [groupAName, groupBName]).catch(() => undefined);
    await prisma.$disconnect();
    await su.$disconnect();
  });

  beforeEach(async () => {
    await cleanupGroups(prisma, su, [groupAName, groupBName]);
    ({ groupId: tenantAGroupId } = await seedGroup(prisma, TENANT_A_ID, groupAName));
    ({ groupId: tenantBGroupId } = await seedGroup(prisma, TENANT_B_ID, groupBName));
    await refreshMv(su);
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
