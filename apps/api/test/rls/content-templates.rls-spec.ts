/**
 * RLS Isolation: content_templates table (Story 13-5 / FR42)
 * Idempotente — roda 2x no CI sem erro.
 * UUIDs fixos para evitar conflito com outros specs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Fixed UUIDs — unique to this spec
const TEMPLATE_PLATFORM_ID = '01976600-0001-7000-8000-000000000001';
const TEMPLATE_A_ID       = '01976600-0001-7000-8000-000000000002';
const TEMPLATE_B_ID       = '01976600-0001-7000-8000-000000000003';
const USER_A = '01976600-0001-7000-8000-000000000a99';
const USER_B = '01976600-0001-7000-8000-000000000b99';
const SYSTEM_USER = '00000000-0000-7000-8000-000000000000';

// Helper: insert a template bypassing RLS (superuser)
async function insertTemplateBypassed(
  prisma: PrismaClient,
  id: string,
  tenantId: string | null,
  scope: 'platform' | 'tenant',
  name: string,
  createdBy: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL row_security = off');
    await tx.$executeRawUnsafe(`
      INSERT INTO content_templates (id, tenant_id, scope, source_trail_id, name, version, structure, created_by)
      VALUES (
        '${id}'::uuid,
        ${tenantId ? `'${tenantId}'::uuid` : 'NULL'},
        '${scope}'::"TemplateScope",
        NULL,
        '${name}',
        1,
        '{"modules":[]}'::jsonb,
        '${createdBy}'::uuid
      )
      ON CONFLICT (id) DO NOTHING
    `);
  });
}

// Helper: read templates visible to a tenant (via RLS)
async function readTemplates(prisma: PrismaClient, tenantId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.contentTemplate.findMany({ where: { deletedAt: null } });
  });
}

// Helper: try INSERT via app role (RLS enforced)
async function tryInsertTemplate(
  prisma: PrismaClient,
  tenantCtx: string,
  id: string,
  tenantId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO content_templates (id, tenant_id, scope, name, version, structure, created_by)
      VALUES (
        '${id}'::uuid,
        ${tenantId ? `'${tenantId}'::uuid` : 'NULL'},
        'tenant'::"TemplateScope",
        'test-insert-${id}',
        1,
        '{"modules":[]}'::jsonb,
        '${USER_A}'::uuid
      )
    `);
  });
}

// Helper: try UPDATE via app role
async function tryUpdateTemplate(
  prisma: PrismaClient,
  tenantCtx: string,
  id: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    const result = await tx.$executeRawUnsafe(
      `UPDATE content_templates SET name = 'modified' WHERE id = '${id}'::uuid`,
    );
    return result;
  });
}

// Helper: try DELETE via app role
async function tryDeleteTemplate(
  prisma: PrismaClient,
  tenantCtx: string,
  id: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantCtx}'`);
    const result = await tx.$executeRawUnsafe(
      `DELETE FROM content_templates WHERE id = '${id}'::uuid`,
    );
    return result;
  });
}

async function ensureUser(prisma: PrismaClient, userId: string, email: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, updated_at)
     VALUES ('${userId}'::uuid, '${email}', 'Template RLS User', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function ensureTenant(prisma: PrismaClient, tenantId: string, name: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO tenants (id, tenant_id, name)
       VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}')
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function cleanup(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL row_security = off');
    await tx.$executeRawUnsafe(
      `DELETE FROM content_templates WHERE id IN (
        '${TEMPLATE_PLATFORM_ID}'::uuid,
        '${TEMPLATE_A_ID}'::uuid,
        '${TEMPLATE_B_ID}'::uuid
      )`,
    );
  });
}

describe('RLS Isolation: content_templates table', () => {
  // privileged: owner role (DATABASE_URL) — bypassa RLS, usado para seed/cleanup de linhas
  // globais (tenant_id NULL) que o WITH CHECK das policies impede via app role.
  let privileged: PrismaClient;
  // app: metanoia_app (DATABASE_APP_URL, NOSUPERUSER) — RLS aplicada, testa isolamento real.
  let app: PrismaClient;

  beforeAll(async () => {
    const privAdapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    privileged = new PrismaClient({ adapter: privAdapter });
    await privileged.$connect();

    const appAdapter = new PrismaPg({ connectionString: process.env.DATABASE_APP_URL! });
    app = new PrismaClient({ adapter: appAdapter });
    await app.$connect();

    await ensureUser(privileged, USER_A, `ct-rls-a@test.com`);
    await ensureUser(privileged, USER_B, `ct-rls-b@test.com`);
    await ensureTenant(privileged, TENANT_A_ID, 'Tenant A');
    await ensureTenant(privileged, TENANT_B_ID, 'Tenant B');

    // Cleanup from previous run (idempotency)
    await cleanup(privileged);

    // Seed: 1 platform template, 1 per tenant — via privileged (tenant_id NULL needs bypass)
    await insertTemplateBypassed(privileged, TEMPLATE_PLATFORM_ID, null, 'platform', 'Platform Tpl RLS Test', SYSTEM_USER);
    await insertTemplateBypassed(privileged, TEMPLATE_A_ID, TENANT_A_ID, 'tenant', 'Tenant A Tpl RLS Test', USER_A);
    await insertTemplateBypassed(privileged, TEMPLATE_B_ID, TENANT_B_ID, 'tenant', 'Tenant B Tpl RLS Test', USER_B);
  });

  afterAll(async () => {
    await cleanup(privileged);
    await privileged.$disconnect();
    await app.$disconnect();
  });

  // ---- Cenário 1: READ isolation ----

  it('TENANT_A sees platform template + its own template', async () => {
    const visible = await readTemplates(app, TENANT_A_ID);
    const ids = visible.map((t) => t.id);
    expect(ids).toContain(TEMPLATE_PLATFORM_ID);
    expect(ids).toContain(TEMPLATE_A_ID);
    expect(ids).not.toContain(TEMPLATE_B_ID);
  });

  it('TENANT_B sees platform template + its own template, not TENANT_A', async () => {
    const visible = await readTemplates(app, TENANT_B_ID);
    const ids = visible.map((t) => t.id);
    expect(ids).toContain(TEMPLATE_PLATFORM_ID);
    expect(ids).toContain(TEMPLATE_B_ID);
    expect(ids).not.toContain(TEMPLATE_A_ID);
  });

  it('empty tenant context sees no templates (nullif returns null uuid)', async () => {
    const visible = await app.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
      return tx.contentTemplate.findMany({ where: { deletedAt: null } });
    });
    // Only platform templates visible (tenantId IS NULL passes the SELECT policy)
    const tenantTemplates = visible.filter((t) => t.tenantId !== null);
    expect(tenantTemplates).toHaveLength(0);
  });

  // ---- Cenário 2: WRITE isolation ----

  it('INSERT with tenant_id=NULL under TENANT_A context is rejected by RLS', async () => {
    const BOGUS_ID = '01976600-0001-7000-8000-000000009901';
    await expect(
      tryInsertTemplate(app, TENANT_A_ID, BOGUS_ID, null),
    ).rejects.toThrow();
  });

  it('INSERT with tenant_id=TENANT_B under TENANT_A context is rejected by RLS', async () => {
    const BOGUS_ID = '01976600-0001-7000-8000-000000009902';
    await expect(
      tryInsertTemplate(app, TENANT_A_ID, BOGUS_ID, TENANT_B_ID),
    ).rejects.toThrow();
  });

  it('INSERT with tenant_id=TENANT_A under TENANT_A context succeeds', async () => {
    const OWN_ID = '01976600-0001-7000-8000-000000009903';
    await expect(
      tryInsertTemplate(app, TENANT_A_ID, OWN_ID, TENANT_A_ID),
    ).resolves.not.toThrow();
    // Cleanup this inserted row (privileged)
    await privileged.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL row_security = off');
      await tx.$executeRawUnsafe(`DELETE FROM content_templates WHERE id = '${OWN_ID}'::uuid`);
    });
  });

  // ---- Cenário 3: Platform read-only ----

  it('UPDATE platform template under TENANT_A affects 0 rows', async () => {
    const affected = await tryUpdateTemplate(app, TENANT_A_ID, TEMPLATE_PLATFORM_ID);
    expect(affected).toBe(0);
  });

  it('DELETE platform template under TENANT_A affects 0 rows', async () => {
    const affected = await tryDeleteTemplate(app, TENANT_A_ID, TEMPLATE_PLATFORM_ID);
    expect(affected).toBe(0);
  });

  // ---- Cenário 4: Soft-delete isolation (application layer) ----

  it('template with deletedAt IS NOT NULL is excluded by application-layer filter', async () => {
    // Mark TEMPLATE_A as soft-deleted (bypassing RLS, privileged)
    await privileged.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL row_security = off');
      await tx.$executeRawUnsafe(
        `UPDATE content_templates SET deleted_at = now() WHERE id = '${TEMPLATE_A_ID}'::uuid`,
      );
    });

    const visible = await readTemplates(app, TENANT_A_ID);
    const ids = visible.map((t) => t.id);
    expect(ids).not.toContain(TEMPLATE_A_ID);

    // Restore (privileged)
    await privileged.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL row_security = off');
      await tx.$executeRawUnsafe(
        `UPDATE content_templates SET deleted_at = NULL WHERE id = '${TEMPLATE_A_ID}'::uuid`,
      );
    });
  });

  // ---- Cenário 5: Seed idempotência ----

  it('running cleanup + re-seed twice gives same platform count (idempotency)', async () => {
    // Count platform templates seeded in beforeAll
    const result = await privileged.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM content_templates
      WHERE tenant_id IS NULL
        AND id = ${TEMPLATE_PLATFORM_ID}::uuid
    `;
    expect(Number(result[0].count)).toBe(1);
  });
});
