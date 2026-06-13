/**
 * RLS isolation tests for onboarding-wizard write paths (Story 10-1).
 *
 * Verifies:
 *   1. `PATCH /tenants/me` (onboarding_progress, logo_url) is tenant-scoped
 *      — Tenant A cannot read/write data of Tenant B.
 *   2. `GET /onboarding/status` returns only the calling tenant's data
 *      (onboarding_progress JSONB, groupCount) — never another tenant's.
 *   3. `PATCH /users/me` (profile_photo_url, role_title) is user+tenant-scoped.
 *   4. `hasRealGroups` counts only the calling tenant's groups (RLS-scoped).
 *   5. NULLIF guard: raw SELECT without SET LOCAL returns 0 rows.
 *
 * Column names confirmed from schema.prisma (evidence-first per GOTCHA #1):
 *   tenants.onboarding_progress (JSONB), tenants.logo_url (text)
 *   users.profile_photo_url (text), users.role_title (text)
 *   tenants: id, tenant_id, name, created_at, updated_at (NOT NULL)
 *   users:   id, email, name, status, tenant_id, created_at, updated_at (NOT NULL)
 *   groups:  id, tenant_id, name, day_of_week, time, recurrence, created_at, updated_at (NOT NULL)
 *   group_members: id, tenant_id, group_id, user_id, role, created_at (no updated_at)
 *
 * Prisma v7 RLS pattern: PrismaPg adapter, UUIDs fixed hex, users global,
 * FK chain in beforeAll, cleanup of only mutable tables in afterAll.
 * Re-grants metanoia_app conforme quickstart §Pré-requisitos.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ─── Fixed UUIDs (hex pattern, never uuidv7()) ───────────────────────────────
const OB_USER_A  = '0b0b0001-0001-7000-8abc-aaa000000001';
const OB_USER_B  = '0b0b0001-0001-7000-8abc-bbb000000001';
const OB_GRP_A1  = '0b0b0001-0001-7000-8abc-aaa000000002';
const OB_GRP_A2  = '0b0b0001-0001-7000-8abc-aaa000000003';
const OB_GRP_B   = '0b0b0001-0001-7000-8abc-bbb000000002';
const OB_GM_A    = '0b0b0001-0001-7000-8abc-aaa000000004';
const OB_GM_B    = '0b0b0001-0001-7000-8abc-bbb000000004';

// ─── Client factories ─────────────────────────────────────────────────────────
function makeAppClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_APP_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function makeSuperuserClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function ensureTenant(su: PrismaClient, tenantId: string, name: string) {
  await su.$executeRawUnsafe(
    `INSERT INTO tenants (id, tenant_id, name, created_at, updated_at)
     VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, '${name}', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
  );
}

/** Users are global — insert without tenant context (no RLS at insert time). */
async function ensureUser(
  su: PrismaClient,
  userId: string,
  email: string,
  tenantId: string,
) {
  await su.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, tenant_id, created_at, updated_at)
     VALUES ('${userId}'::uuid, '${email}', 'OB RLS User', 'active',
             '${tenantId}'::uuid, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function ensureGroup(
  su: PrismaClient,
  groupId: string,
  tenantId: string,
  nameSuffix: string,
) {
  await su.$executeRawUnsafe(
    `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, created_at, updated_at)
     VALUES ('${groupId}'::uuid, '${tenantId}'::uuid, 'OB Group ${nameSuffix}',
             'fri', '19:00', 'weekly', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function ensureGroupMember(
  su: PrismaClient,
  gmId: string,
  groupId: string,
  userId: string,
  tenantId: string,
) {
  // group_members has no updated_at column (confirmed from schema.prisma)
  await su.$executeRawUnsafe(
    `INSERT INTO group_members (id, tenant_id, group_id, user_id, role, created_at)
     VALUES ('${gmId}'::uuid, '${tenantId}'::uuid, '${groupId}'::uuid,
             '${userId}'::uuid, 'membro', NOW())
     ON CONFLICT (id) DO NOTHING`,
  );
}

/** Re-grant metanoia_app privileges (idempotent; matches quickstart §Pré-requisitos). */
async function ensureGrants(su: PrismaClient) {
  await su.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO metanoia_app`,
  );
  await su.$executeRawUnsafe(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO metanoia_app`,
  );
}

// ─── Suite ───────────────────────────────────────────────────────────────────
describe('onboarding-wizard — RLS isolation', () => {
  let app: PrismaClient;
  let su: PrismaClient;

  beforeAll(async () => {
    su = makeSuperuserClient();
    app = makeAppClient();

    await ensureGrants(su);

    // Tenants first (FK parents)
    await ensureTenant(su, TENANT_A_ID, 'OB RLS Tenant A');
    await ensureTenant(su, TENANT_B_ID, 'OB RLS Tenant B');

    // Users (global — no RLS)
    await ensureUser(su, OB_USER_A, `ob-rls-user-a@rls.test`, TENANT_A_ID);
    await ensureUser(su, OB_USER_B, `ob-rls-user-b@rls.test`, TENANT_B_ID);

    // Groups (2 for A, 1 for B — hasRealGroups test needs count)
    await ensureGroup(su, OB_GRP_A1, TENANT_A_ID, 'A1');
    await ensureGroup(su, OB_GRP_A2, TENANT_A_ID, 'A2');
    await ensureGroup(su, OB_GRP_B,  TENANT_B_ID, 'B');

    // Group members
    await ensureGroupMember(su, OB_GM_A, OB_GRP_A1, OB_USER_A, TENANT_A_ID);
    await ensureGroupMember(su, OB_GM_B, OB_GRP_B,  OB_USER_B, TENANT_B_ID);
  });

  afterAll(async () => {
    // Cleanup in FK order (children before parents)
    await su.$executeRawUnsafe(
      `DELETE FROM group_members WHERE id IN ('${OB_GM_A}'::uuid, '${OB_GM_B}'::uuid)`,
    );
    await su.$executeRawUnsafe(
      `DELETE FROM groups WHERE id IN ('${OB_GRP_A1}'::uuid, '${OB_GRP_A2}'::uuid, '${OB_GRP_B}'::uuid)`,
    );
    await su.$executeRawUnsafe(
      `DELETE FROM users WHERE id IN ('${OB_USER_A}'::uuid, '${OB_USER_B}'::uuid)`,
    );

    // Reset onboarding_progress and logo_url set during tests
    await su.$executeRawUnsafe(
      `UPDATE tenants SET onboarding_progress = NULL, logo_url = NULL
       WHERE id IN ('${TENANT_A_ID}'::uuid, '${TENANT_B_ID}'::uuid)`,
    );

    await app.$disconnect();
    await su.$disconnect();
  });

  // ── 1. NULLIF guard — SELECT without SET LOCAL returns 0 rows ───────────────
  describe('NULLIF guard', () => {
    it('SELECT tenants without tenant context returns 0 rows', async () => {
      // Raw read without SET LOCAL — NULLIF guard filters all rows
      const rows = await app.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM tenants WHERE id IN ('${TENANT_A_ID}'::uuid, '${TENANT_B_ID}'::uuid)`,
      );
      expect(rows).toHaveLength(0);
    });

    it('SELECT groups without tenant context returns 0 rows', async () => {
      const rows = await app.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM groups WHERE id IN ('${OB_GRP_A1}'::uuid, '${OB_GRP_A2}'::uuid, '${OB_GRP_B}'::uuid)`,
      );
      expect(rows).toHaveLength(0);
    });
  });

  // ── 2. onboarding_progress is tenant-scoped ──────────────────────────────────
  describe('onboarding_progress (JSONB) — tenant isolation', () => {
    it('Tenant A writes onboarding_progress — Tenant B cannot read it', async () => {
      const progressA = {
        completedSteps: [1, 2],
        currentStep: 3,
        completed: false,
        skippedAt: null,
        completedAt: null,
      };

      // Write as Tenant A (simulates PATCH /tenants/me)
      await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        await tx.$executeRawUnsafe(
          `UPDATE tenants
           SET onboarding_progress = '${JSON.stringify(progressA)}'::jsonb,
               updated_at = NOW()
           WHERE id = '${TENANT_A_ID}'::uuid`,
        );
      });

      // Read as Tenant B — should see its own tenant row only, NOT Tenant A's progress
      const rowsB = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
        return tx.$queryRawUnsafe<{ id: string; onboarding_progress: unknown }[]>(
          `SELECT id, onboarding_progress FROM tenants
           WHERE id = '${TENANT_A_ID}'::uuid`,
        );
      });

      // Tenant B cannot see Tenant A's row
      expect(rowsB).toHaveLength(0);
    });

    it('Tenant A reads its own onboarding_progress correctly', async () => {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        return tx.$queryRawUnsafe<{ onboarding_progress: unknown }[]>(
          `SELECT onboarding_progress FROM tenants WHERE id = '${TENANT_A_ID}'::uuid`,
        );
      });

      expect(rows).toHaveLength(1);
      const progress = rows[0]?.onboarding_progress as {
        completedSteps: number[];
        currentStep: number;
      };
      expect(progress.completedSteps).toContain(1);
      expect(progress.completedSteps).toContain(2);
      expect(progress.currentStep).toBe(3);
    });
  });

  // ── 3. logo_url is tenant-scoped ─────────────────────────────────────────────
  describe('logo_url — tenant isolation', () => {
    it('Tenant A writes logo_url — Tenant B cannot read it', async () => {
      // Write as Tenant A
      await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        await tx.$executeRawUnsafe(
          `UPDATE tenants
           SET logo_url = 'https://cdn.example.com/tenantA/logo.png',
               updated_at = NOW()
           WHERE id = '${TENANT_A_ID}'::uuid`,
        );
      });

      // Tenant B cannot read Tenant A's row
      const rowsB = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
        return tx.$queryRawUnsafe<{ logo_url: string | null }[]>(
          `SELECT logo_url FROM tenants WHERE id = '${TENANT_A_ID}'::uuid`,
        );
      });

      expect(rowsB).toHaveLength(0);
    });
  });

  // ── 4. users profile fields are tenant+user-scoped ───────────────────────────
  describe('users profile (profile_photo_url, role_title) — isolation', () => {
    it('Tenant A writes user profile — Tenant B cannot read it', async () => {
      // Write as Tenant A context (simulates PATCH /users/me)
      await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        await tx.$executeRawUnsafe(
          `UPDATE users
           SET profile_photo_url = 'https://cdn.example.com/tenantA/photo.jpg',
               role_title = 'Pastor Principal',
               updated_at = NOW()
           WHERE id = '${OB_USER_A}'::uuid`,
        );
      });

      // Tenant B attempts to read User A's profile
      const rowsB = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
        return tx.$queryRawUnsafe<{ profile_photo_url: string | null; role_title: string | null }[]>(
          `SELECT profile_photo_url, role_title FROM users WHERE id = '${OB_USER_A}'::uuid`,
        );
      });

      // users table RLS: Tenant B cannot see User A (different tenant_id)
      expect(rowsB).toHaveLength(0);
    });

    it('Tenant A reads its own user profile_photo_url correctly', async () => {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        return tx.$queryRawUnsafe<{ profile_photo_url: string | null; role_title: string | null }[]>(
          `SELECT profile_photo_url, role_title FROM users WHERE id = '${OB_USER_A}'::uuid`,
        );
      });

      expect(rows).toHaveLength(1);
      expect(rows[0]?.profile_photo_url).toBe('https://cdn.example.com/tenantA/photo.jpg');
      expect(rows[0]?.role_title).toBe('Pastor Principal');
    });
  });

  // ── 5. hasRealGroups — group count is tenant-scoped ──────────────────────────
  describe('hasRealGroups — group count isolation', () => {
    it('Tenant A sees only its own groups (2)', async () => {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        return tx.$queryRawUnsafe<{ count: string }[]>(
          `SELECT COUNT(*) AS count FROM groups WHERE is_demo_data = false`,
        );
      });

      const count = parseInt(rows[0]?.count ?? '0', 10);
      // At least 2 (the ones we seeded — may have more from other tests)
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('Tenant B sees only its own groups (1)', async () => {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
        return tx.$queryRawUnsafe<{ count: string }[]>(
          `SELECT COUNT(*) AS count FROM groups WHERE is_demo_data = false`,
        );
      });

      const count = parseInt(rows[0]?.count ?? '0', 10);
      // At least 1 (the one we seeded — but must NOT see Tenant A's 2 groups)
      expect(count).toBeGreaterThanOrEqual(1);

      // Cross-check: verify Tenant A's specific groups are NOT visible to Tenant B
      const leakCheck = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
        return tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM groups WHERE id IN ('${OB_GRP_A1}'::uuid, '${OB_GRP_A2}'::uuid)`,
        );
      });
      expect(leakCheck).toHaveLength(0);
    });

    it('Tenant A groups are NOT visible to Tenant B (explicit leak check)', async () => {
      const rows = await app.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
        return tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM groups
           WHERE tenant_id = '${TENANT_A_ID}'::uuid`,
        );
      });
      expect(rows).toHaveLength(0);
    });
  });
});
