/**
 * RLS isolation tests for `isDemoData=true` rows across the 12 demo tables.
 *
 * Story 10-2 (Dados de Demonstração — Isolamento RLS)
 * spec §4.1 / data-model.md §RLS / tasks.md FASE 4
 *
 * Tests verify (SEC011):
 *  1. Rows seeded with isDemoData=true in Tenant A are NOT visible to Tenant B
 *  2. NULLIF guard: SELECT without SET LOCAL returns 0 rows
 *  3. RLS isolation is enforced by DB policy, not application-level filtering
 *
 * Tables covered: users, groups, group_members, meetings, meeting_attendance,
 * meeting_telemetry, pastoral_actions, trails, modules, lessons,
 * trail_progress, module_progress.
 *
 * Fixed UUIDs (hex pattern) per project RLS spec convention — no uuidv7().
 * users are global (not tenant-scoped in fixture insert); FK chain maintained
 * by beforeAll. Cleanup: only mutable tables; beforeEach resets mutable rows.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ─── Fixed UUIDs ──────────────────────────────────────────────────────────────
const DEMO_USER_A   = '01abdcef-1234-7000-8abc-aaa000000001';
const DEMO_USER_B   = '01abdcef-1234-7000-8abc-bbb000000001';
const DEMO_GROUP_A  = '01abdcef-1234-7000-8abc-aaa000000002';
const DEMO_GROUP_B  = '01abdcef-1234-7000-8abc-bbb000000002';
const DEMO_GM_A     = '01abdcef-1234-7000-8abc-aaa000000003';
const DEMO_GM_B     = '01abdcef-1234-7000-8abc-bbb000000003';
const DEMO_MTG_A    = '01abdcef-1234-7000-8abc-aaa000000004';
const DEMO_MTG_B    = '01abdcef-1234-7000-8abc-bbb000000004';
const DEMO_ATTEND_A = '01abdcef-1234-7000-8abc-aaa000000005';
const DEMO_ATTEND_B = '01abdcef-1234-7000-8abc-bbb000000005';
const DEMO_TELEM_A  = '01abdcef-1234-7000-8abc-aaa000000006';
const DEMO_TELEM_B  = '01abdcef-1234-7000-8abc-bbb000000006';
const DEMO_PA_A     = '01abdcef-1234-7000-8abc-aaa000000007';
const DEMO_PA_B     = '01abdcef-1234-7000-8abc-bbb000000007';
const DEMO_TRAIL_A  = '01abdcef-1234-7000-8abc-aaa000000008';
const DEMO_TRAIL_B  = '01abdcef-1234-7000-8abc-bbb000000008';
const DEMO_MOD_A    = '01abdcef-1234-7000-8abc-aaa000000009';
const DEMO_MOD_B    = '01abdcef-1234-7000-8abc-bbb000000009';
const DEMO_LES_A    = '01abdcef-1234-7000-8abc-aaa00000000a';
const DEMO_LES_B    = '01abdcef-1234-7000-8abc-bbb00000000a';
const DEMO_TP_A     = '01abdcef-1234-7000-8abc-aaa00000000b';
const DEMO_TP_B     = '01abdcef-1234-7000-8abc-bbb00000000b';
const DEMO_MP_A     = '01abdcef-1234-7000-8abc-aaa00000000c';
const DEMO_MP_B     = '01abdcef-1234-7000-8abc-bbb00000000c';

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

/**
 * Users are global — inserted without tenant context (no RLS on users table
 * at insert time when user has no tenantId yet). Matches the pattern used in
 * deletion-requests.rls-spec.ts and groups.rls-spec.ts.
 */
async function ensureUser(
  prisma: PrismaClient,
  userId: string,
  email: string,
  tenantId: string,
  isDemoData: boolean,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, tenant_id, is_demo_data, created_at, updated_at)
       VALUES ('${userId}'::uuid, '${email}', 'Demo RLS User', 'active',
               '${tenantId}'::uuid, ${isDemoData}, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

/** Seed the full FK chain for a tenant (demo-flagged rows). */
async function seedDemoChain(
  prisma: PrismaClient,
  tenantId: string,
  ids: {
    userId: string; groupId: string; gmId: string; mtgId: string;
    attendId: string; telemId: string; paId: string;
    trailId: string; modId: string; lesId: string;
    tpId: string; mpId: string;
  },
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

    // group
    await tx.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, is_demo_data, created_at, updated_at)
       VALUES ('${ids.groupId}'::uuid, '${tenantId}'::uuid, 'Demo Group ${tenantId.slice(-4)}',
               'fri', '19:00', 'weekly', true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // group_member — no updated_at column
    await tx.$executeRawUnsafe(
      `INSERT INTO group_members (id, tenant_id, group_id, user_id, role, is_demo_data, created_at)
       VALUES ('${ids.gmId}'::uuid, '${tenantId}'::uuid, '${ids.groupId}'::uuid,
               '${ids.userId}'::uuid, 'membro', true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // meeting
    await tx.$executeRawUnsafe(
      `INSERT INTO meetings (id, tenant_id, group_id, scheduled_for, status, is_demo_data, created_at, updated_at)
       VALUES ('${ids.mtgId}'::uuid, '${tenantId}'::uuid, '${ids.groupId}'::uuid,
               NOW(), 'ended', true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // meeting_attendance — no updated_at column; has unique(meeting_id, user_id)
    await tx.$executeRawUnsafe(
      `INSERT INTO meeting_attendance
         (id, tenant_id, meeting_id, user_id, join_time, leave_time,
          total_duration_seconds, presence_type, is_demo_data, created_at)
       VALUES ('${ids.attendId}'::uuid, '${tenantId}'::uuid, '${ids.mtgId}'::uuid,
               '${ids.userId}'::uuid, NOW(), NOW(), 3600, 'integral', true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // meeting_telemetry — no updated_at column; has unique(meeting_id, user_id)
    await tx.$executeRawUnsafe(
      `INSERT INTO meeting_telemetry
         (id, tenant_id, meeting_id, user_id, camera_on_seconds,
          room_duration_seconds, is_demo_data, created_at)
       VALUES ('${ids.telemId}'::uuid, '${tenantId}'::uuid, '${ids.mtgId}'::uuid,
               '${ids.userId}'::uuid, 1800, 3600, true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // pastoral_action — no updated_at column
    await tx.$executeRawUnsafe(
      `INSERT INTO pastoral_actions
         (id, tenant_id, participant_id, group_id, performed_by,
          action_type, signal_type, is_demo_data, recorded_at)
       VALUES ('${ids.paId}'::uuid, '${tenantId}'::uuid, '${ids.userId}'::uuid,
               '${ids.groupId}'::uuid, '${ids.userId}'::uuid,
               'contact', 'care-routine', true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // trail
    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, title, description, is_demo_data, created_at, updated_at)
       VALUES ('${ids.trailId}'::uuid, '${tenantId}'::uuid,
               'Demo Trail ${tenantId.slice(-4)}', 'demo', true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // module
    await tx.$executeRawUnsafe(
      `INSERT INTO modules (id, tenant_id, trail_id, title, description, order_index, is_demo_data, created_at, updated_at)
       VALUES ('${ids.modId}'::uuid, '${tenantId}'::uuid, '${ids.trailId}'::uuid,
               'Demo Module', 'demo', 1, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // lesson
    await tx.$executeRawUnsafe(
      `INSERT INTO lessons (id, tenant_id, module_id, title, content_type, order_index, is_demo_data, created_at, updated_at)
       VALUES ('${ids.lesId}'::uuid, '${tenantId}'::uuid, '${ids.modId}'::uuid,
               'Demo Lesson', 'text', 1, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // trail_progress
    await tx.$executeRawUnsafe(
      `INSERT INTO trail_progress
         (id, tenant_id, user_id, trail_id, progress_percent, completed_modules,
          total_modules, is_demo_data, updated_at)
       VALUES ('${ids.tpId}'::uuid, '${tenantId}'::uuid, '${ids.userId}'::uuid,
               '${ids.trailId}'::uuid, 50, 1, 2, true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // module_progress
    await tx.$executeRawUnsafe(
      `INSERT INTO module_progress
         (id, tenant_id, user_id, module_id, progress_percent, completed_lessons,
          total_lessons, is_demo_data, updated_at)
       VALUES ('${ids.mpId}'::uuid, '${tenantId}'::uuid, '${ids.userId}'::uuid,
               '${ids.modId}'::uuid, 50, 1, 2, true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function countWithTenant(
  prisma: PrismaClient,
  tenantId: string,
  table: string,
  id: string,
): Promise<number> {
  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE id = '${id}'::uuid`,
    );
  });
  return Number(rows[0]?.count ?? 0);
}

async function countWithoutTenant(
  prisma: PrismaClient,
  table: string,
  id: string,
): Promise<number> {
  // No SET LOCAL — NULLIF guard returns 0 rows
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count FROM ${table} WHERE id = '${id}'::uuid`,
  );
  return Number(rows[0]?.count ?? 0);
}

/** Cleanup: delete demo rows in reverse FK order (same as deleteDemoData). */
async function cleanupDemoChain(su: PrismaClient) {
  const allIds = [
    DEMO_MP_A, DEMO_MP_B, DEMO_TP_A, DEMO_TP_B,
    DEMO_LES_A, DEMO_LES_B, DEMO_MOD_A, DEMO_MOD_B,
    DEMO_TRAIL_A, DEMO_TRAIL_B, DEMO_PA_A, DEMO_PA_B,
    DEMO_TELEM_A, DEMO_TELEM_B, DEMO_ATTEND_A, DEMO_ATTEND_B,
    DEMO_MTG_A, DEMO_MTG_B, DEMO_GM_A, DEMO_GM_B,
    DEMO_GROUP_A, DEMO_GROUP_B,
  ];
  const userIds = [DEMO_USER_A, DEMO_USER_B];

  // Reverse FK order — same as DemoDataService.deleteDemoData
  const tables = [
    'module_progress', 'trail_progress', 'lessons', 'modules', 'trails',
    'pastoral_actions', 'meeting_telemetry', 'meeting_attendance', 'meetings',
    'group_members', 'groups',
  ];
  for (const table of tables) {
    const ids = allIds.map((id) => `'${id}'::uuid`).join(', ');
    await su.$executeRawUnsafe(
      `DELETE FROM ${table} WHERE id IN (${ids})`,
    );
  }
  const uids = userIds.map((id) => `'${id}'::uuid`).join(', ');
  await su.$executeRawUnsafe(`DELETE FROM users WHERE id IN (${uids})`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('demo_data isDemoData RLS isolation (Story 10-2, SEC011)', () => {
  let prisma: PrismaClient;
  let su: PrismaClient;

  beforeAll(async () => {
    prisma = makeAppClient();
    su = makeSuperuserClient();

    await ensureTenant(su, TENANT_A_ID, 'Igreja Alpha (Demo Isolation)');
    await ensureTenant(su, TENANT_B_ID, 'Igreja Beta (Demo Isolation)');

    await ensureUser(prisma, DEMO_USER_A, 'demo-isol-a@rls.test', TENANT_A_ID, true);
    await ensureUser(prisma, DEMO_USER_B, 'demo-isol-b@rls.test', TENANT_B_ID, true);

    await seedDemoChain(prisma, TENANT_A_ID, {
      userId: DEMO_USER_A, groupId: DEMO_GROUP_A, gmId: DEMO_GM_A,
      mtgId: DEMO_MTG_A, attendId: DEMO_ATTEND_A, telemId: DEMO_TELEM_A,
      paId: DEMO_PA_A, trailId: DEMO_TRAIL_A, modId: DEMO_MOD_A,
      lesId: DEMO_LES_A, tpId: DEMO_TP_A, mpId: DEMO_MP_A,
    });
    await seedDemoChain(prisma, TENANT_B_ID, {
      userId: DEMO_USER_B, groupId: DEMO_GROUP_B, gmId: DEMO_GM_B,
      mtgId: DEMO_MTG_B, attendId: DEMO_ATTEND_B, telemId: DEMO_TELEM_B,
      paId: DEMO_PA_B, trailId: DEMO_TRAIL_B, modId: DEMO_MOD_B,
      lesId: DEMO_LES_B, tpId: DEMO_TP_B, mpId: DEMO_MP_B,
    });
  });

  afterAll(async () => {
    await cleanupDemoChain(su);
    await prisma.$disconnect();
    await su.$disconnect();
  });

  // ── users ────────────────────────────────────────────────────────────────
  it('users: tenant A sees its demo user', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'users', DEMO_USER_A)).toBe(1);
  });
  it('users: tenant A does NOT see tenant B demo user', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'users', DEMO_USER_B)).toBe(0);
  });
  it('users: SELECT without tenant context returns 0 (NULLIF guard)', async () => {
    expect(await countWithoutTenant(prisma, 'users', DEMO_USER_A)).toBe(0);
  });

  // ── groups ───────────────────────────────────────────────────────────────
  it('groups: tenant A sees its demo group', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'groups', DEMO_GROUP_A)).toBe(1);
  });
  it('groups: tenant A does NOT see tenant B demo group', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'groups', DEMO_GROUP_B)).toBe(0);
  });
  it('groups: SELECT without tenant context returns 0 (NULLIF guard)', async () => {
    expect(await countWithoutTenant(prisma, 'groups', DEMO_GROUP_A)).toBe(0);
  });

  // ── group_members ────────────────────────────────────────────────────────
  it('group_members: tenant A sees its demo member', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'group_members', DEMO_GM_A)).toBe(1);
  });
  it('group_members: tenant A does NOT see tenant B demo member', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'group_members', DEMO_GM_B)).toBe(0);
  });

  // ── meetings ─────────────────────────────────────────────────────────────
  it('meetings: tenant A sees its demo meeting', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'meetings', DEMO_MTG_A)).toBe(1);
  });
  it('meetings: tenant A does NOT see tenant B demo meeting', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'meetings', DEMO_MTG_B)).toBe(0);
  });

  // ── meeting_attendance ───────────────────────────────────────────────────
  it('meeting_attendance: tenant A sees its demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'meeting_attendance', DEMO_ATTEND_A)).toBe(1);
  });
  it('meeting_attendance: tenant A does NOT see tenant B demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'meeting_attendance', DEMO_ATTEND_B)).toBe(0);
  });

  // ── meeting_telemetry ────────────────────────────────────────────────────
  it('meeting_telemetry: tenant A sees its demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'meeting_telemetry', DEMO_TELEM_A)).toBe(1);
  });
  it('meeting_telemetry: tenant A does NOT see tenant B demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'meeting_telemetry', DEMO_TELEM_B)).toBe(0);
  });

  // ── pastoral_actions ─────────────────────────────────────────────────────
  it('pastoral_actions: tenant A sees its demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'pastoral_actions', DEMO_PA_A)).toBe(1);
  });
  it('pastoral_actions: tenant A does NOT see tenant B demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'pastoral_actions', DEMO_PA_B)).toBe(0);
  });

  // ── trails ───────────────────────────────────────────────────────────────
  it('trails: tenant A sees its demo trail', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'trails', DEMO_TRAIL_A)).toBe(1);
  });
  it('trails: tenant A does NOT see tenant B demo trail', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'trails', DEMO_TRAIL_B)).toBe(0);
  });

  // ── modules ──────────────────────────────────────────────────────────────
  it('modules: tenant A sees its demo module', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'modules', DEMO_MOD_A)).toBe(1);
  });
  it('modules: tenant A does NOT see tenant B demo module', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'modules', DEMO_MOD_B)).toBe(0);
  });

  // ── lessons ──────────────────────────────────────────────────────────────
  it('lessons: tenant A sees its demo lesson', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'lessons', DEMO_LES_A)).toBe(1);
  });
  it('lessons: tenant A does NOT see tenant B demo lesson', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'lessons', DEMO_LES_B)).toBe(0);
  });

  // ── trail_progress ───────────────────────────────────────────────────────
  it('trail_progress: tenant A sees its demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'trail_progress', DEMO_TP_A)).toBe(1);
  });
  it('trail_progress: tenant A does NOT see tenant B demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'trail_progress', DEMO_TP_B)).toBe(0);
  });

  // ── module_progress ──────────────────────────────────────────────────────
  it('module_progress: tenant A sees its demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'module_progress', DEMO_MP_A)).toBe(1);
  });
  it('module_progress: tenant A does NOT see tenant B demo record', async () => {
    expect(await countWithTenant(prisma, TENANT_A_ID, 'module_progress', DEMO_MP_B)).toBe(0);
  });
});
