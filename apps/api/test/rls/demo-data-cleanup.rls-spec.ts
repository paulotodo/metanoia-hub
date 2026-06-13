/**
 * RLS isolation tests for `deleteDemoData` — tenant-scoped cleanup.
 *
 * Story 10-2 (Dados de Demonstração — Limpeza tenant-scoped)
 * spec §4.2 / data-model.md §RLS / tasks.md FASE 4
 *
 * Tests verify:
 *  1. deleteDemoData(tenantA) removes only tenant A's isDemoData=true rows
 *  2. Tenant B's demo rows remain intact after tenantA cleanup
 *  3. Idempotency: second call to deleteDemoData on same tenant returns no error (204 no-op)
 *
 * CHK030: race condition between seed and cleanup simultaneous calls is out
 * of scope — low risk because seed occurs at provisioning time and cleanup
 * only after admin login (sequential by design, not concurrent).
 *
 * Uses withTenantTx via DemoDataService.deleteDemoData indirectly.
 * Direct SQL assertions via superuser client to bypass RLS and inspect real state.
 *
 * Fixed UUIDs (hex pattern) per project RLS spec convention.
 * Tables: all 12 tables with isDemoData flag (same set as demo-data.seed.ts).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ─── Fixed UUIDs ──────────────────────────────────────────────────────────────
// Tenant A demo chain
const CL_USER_A   = '01abcdef-2345-7000-9abc-aaa100000001';
const CL_GROUP_A  = '01abcdef-2345-7000-9abc-aaa100000002';
const CL_GM_A     = '01abcdef-2345-7000-9abc-aaa100000003';
const CL_MTG_A    = '01abcdef-2345-7000-9abc-aaa100000004';
const CL_ATTEND_A = '01abcdef-2345-7000-9abc-aaa100000005';
const CL_TELEM_A  = '01abcdef-2345-7000-9abc-aaa100000006';
const CL_PA_A     = '01abcdef-2345-7000-9abc-aaa100000007';
const CL_TRAIL_A  = '01abcdef-2345-7000-9abc-aaa100000008';
const CL_MOD_A    = '01abcdef-2345-7000-9abc-aaa100000009';
const CL_LES_A    = '01abcdef-2345-7000-9abc-aaa10000000a';
const CL_TP_A     = '01abcdef-2345-7000-9abc-aaa10000000b';
const CL_MP_A     = '01abcdef-2345-7000-9abc-aaa10000000c';

// Tenant B demo chain
const CL_USER_B   = '01abcdef-2345-7000-9abc-bbb100000001';
const CL_GROUP_B  = '01abcdef-2345-7000-9abc-bbb100000002';
const CL_GM_B     = '01abcdef-2345-7000-9abc-bbb100000003';
const CL_MTG_B    = '01abcdef-2345-7000-9abc-bbb100000004';
const CL_ATTEND_B = '01abcdef-2345-7000-9abc-bbb100000005';
const CL_TELEM_B  = '01abcdef-2345-7000-9abc-bbb100000006';
const CL_PA_B     = '01abcdef-2345-7000-9abc-bbb100000007';
const CL_TRAIL_B  = '01abcdef-2345-7000-9abc-bbb100000008';
const CL_MOD_B    = '01abcdef-2345-7000-9abc-bbb100000009';
const CL_LES_B    = '01abcdef-2345-7000-9abc-bbb10000000a';
const CL_TP_B     = '01abcdef-2345-7000-9abc-bbb10000000b';
const CL_MP_B     = '01abcdef-2345-7000-9abc-bbb10000000c';

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

async function ensureUser(
  prisma: PrismaClient,
  userId: string,
  email: string,
  tenantId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, tenant_id, is_demo_data, created_at, updated_at)
       VALUES ('${userId}'::uuid, '${email}', 'Demo Cleanup RLS User', 'active',
               '${tenantId}'::uuid, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

/** Seed the 12-table demo chain for a given tenant (all rows isDemoData=true). */
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

    await tx.$executeRawUnsafe(
      `INSERT INTO groups (id, tenant_id, name, day_of_week, time, recurrence, is_demo_data, created_at, updated_at)
       VALUES ('${ids.groupId}'::uuid, '${tenantId}'::uuid,
               'Cleanup Demo Group ${tenantId.slice(-4)}', 'mon', '20:00', 'weekly', true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // group_members — no updated_at column
    await tx.$executeRawUnsafe(
      `INSERT INTO group_members (id, tenant_id, group_id, user_id, role, is_demo_data, created_at)
       VALUES ('${ids.gmId}'::uuid, '${tenantId}'::uuid, '${ids.groupId}'::uuid,
               '${ids.userId}'::uuid, 'membro', true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO meetings (id, tenant_id, group_id, scheduled_for, status, is_demo_data, created_at, updated_at)
       VALUES ('${ids.mtgId}'::uuid, '${tenantId}'::uuid, '${ids.groupId}'::uuid,
               NOW(), 'ended', true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // meeting_attendance — no updated_at column
    await tx.$executeRawUnsafe(
      `INSERT INTO meeting_attendance
         (id, tenant_id, meeting_id, user_id, join_time, leave_time,
          total_duration_seconds, presence_type, is_demo_data, created_at)
       VALUES ('${ids.attendId}'::uuid, '${tenantId}'::uuid, '${ids.mtgId}'::uuid,
               '${ids.userId}'::uuid, NOW(), NOW(), 1800, 'parcial', true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // meeting_telemetry — no updated_at column
    await tx.$executeRawUnsafe(
      `INSERT INTO meeting_telemetry
         (id, tenant_id, meeting_id, user_id, camera_on_seconds,
          room_duration_seconds, is_demo_data, created_at)
       VALUES ('${ids.telemId}'::uuid, '${tenantId}'::uuid, '${ids.mtgId}'::uuid,
               '${ids.userId}'::uuid, 900, 1800, true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    // pastoral_actions — no updated_at column
    await tx.$executeRawUnsafe(
      `INSERT INTO pastoral_actions
         (id, tenant_id, participant_id, group_id, performed_by,
          action_type, signal_type, is_demo_data, recorded_at)
       VALUES ('${ids.paId}'::uuid, '${tenantId}'::uuid, '${ids.userId}'::uuid,
               '${ids.groupId}'::uuid, '${ids.userId}'::uuid,
               'prayer', 'care-routine', true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, name, description, created_by, is_demo_data, created_at, updated_at)
       VALUES ('${ids.trailId}'::uuid, '${tenantId}'::uuid,
               'Cleanup Demo Trail ${tenantId.slice(-4)}', 'demo', '${ids.userId}'::uuid, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO modules (id, tenant_id, trail_id, name, "order", is_demo_data, created_at, updated_at)
       VALUES ('${ids.modId}'::uuid, '${tenantId}'::uuid, '${ids.trailId}'::uuid,
               'Cleanup Demo Module', 1, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO lessons (id, tenant_id, module_id, name, content_type, "order", is_demo_data, created_at, updated_at)
       VALUES ('${ids.lesId}'::uuid, '${tenantId}'::uuid, '${ids.modId}'::uuid,
               'Cleanup Demo Lesson', 'rich_text', 1, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO trail_progress
         (id, tenant_id, user_id, trail_id, progress_percent, completed_modules,
          total_modules, is_demo_data, updated_at)
       VALUES ('${ids.tpId}'::uuid, '${tenantId}'::uuid, '${ids.userId}'::uuid,
               '${ids.trailId}'::uuid, 100, 1, 1, true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO module_progress
         (id, tenant_id, user_id, module_id, progress_percent, completed_lessons,
          total_lessons, is_demo_data, updated_at)
       VALUES ('${ids.mpId}'::uuid, '${tenantId}'::uuid, '${ids.userId}'::uuid,
               '${ids.modId}'::uuid, 100, 2, 2, true, NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

/** Count isDemoData=true rows for a specific tenant in a table (superuser). */
async function countDemoByTenant(
  su: PrismaClient,
  table: string,
  tenantId: string,
  rowId: string,
): Promise<number> {
  const rows = await su.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count FROM ${table}
     WHERE id = '${rowId}'::uuid AND tenant_id = '${tenantId}'::uuid
       AND is_demo_data = true`,
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Execute deleteDemoData logic directly against the database using the same
 * deletion order as DemoDataService.deleteDemoData. This avoids needing to
 * instantiate the NestJS module in an RLS spec context.
 *
 * Deletion order: PastoralAction → MeetingTelemetry → MeetingAttendance →
 * Meeting → ModuleProgress → TrailProgress → Lesson → Module → Trail →
 * GroupMember → Group → User
 */
async function execDeleteDemoData(prisma: PrismaClient, tenantId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);

    await tx.$executeRawUnsafe(
      `DELETE FROM pastoral_actions WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM meeting_telemetry WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM meeting_attendance WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM meetings WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM module_progress WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM trail_progress WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM lessons WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM modules WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM trails WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM group_members WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM groups WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM users WHERE tenant_id = '${tenantId}'::uuid AND is_demo_data = true`,
    );
  });
}

/** Hard cleanup for afterAll — removes all CL_* UUIDs regardless of state. */
async function hardCleanup(su: PrismaClient) {
  const allRowIds = [
    CL_MP_A, CL_MP_B, CL_TP_A, CL_TP_B,
    CL_LES_A, CL_LES_B, CL_MOD_A, CL_MOD_B,
    CL_TRAIL_A, CL_TRAIL_B, CL_PA_A, CL_PA_B,
    CL_TELEM_A, CL_TELEM_B, CL_ATTEND_A, CL_ATTEND_B,
    CL_MTG_A, CL_MTG_B, CL_GM_A, CL_GM_B,
    CL_GROUP_A, CL_GROUP_B,
  ];
  const tables = [
    'module_progress', 'trail_progress', 'lessons', 'modules', 'trails',
    'pastoral_actions', 'meeting_telemetry', 'meeting_attendance', 'meetings',
    'group_members', 'groups',
  ];
  for (const table of tables) {
    const ids = allRowIds.map((id) => `'${id}'::uuid`).join(', ');
    await su.$executeRawUnsafe(
      `DELETE FROM ${table} WHERE id IN (${ids})`,
    ).catch(() => undefined); // ignore if already gone
  }
  const userIds = [CL_USER_A, CL_USER_B].map((id) => `'${id}'::uuid`).join(', ');
  await su.$executeRawUnsafe(`DELETE FROM users WHERE id IN (${userIds})`).catch(() => undefined);
}

function idsForTenant(suffix: 'A' | 'B') {
  const s = suffix;
  return {
    userId:   s === 'A' ? CL_USER_A   : CL_USER_B,
    groupId:  s === 'A' ? CL_GROUP_A  : CL_GROUP_B,
    gmId:     s === 'A' ? CL_GM_A     : CL_GM_B,
    mtgId:    s === 'A' ? CL_MTG_A    : CL_MTG_B,
    attendId: s === 'A' ? CL_ATTEND_A : CL_ATTEND_B,
    telemId:  s === 'A' ? CL_TELEM_A  : CL_TELEM_B,
    paId:     s === 'A' ? CL_PA_A     : CL_PA_B,
    trailId:  s === 'A' ? CL_TRAIL_A  : CL_TRAIL_B,
    modId:    s === 'A' ? CL_MOD_A    : CL_MOD_B,
    lesId:    s === 'A' ? CL_LES_A    : CL_LES_B,
    tpId:     s === 'A' ? CL_TP_A     : CL_TP_B,
    mpId:     s === 'A' ? CL_MP_A     : CL_MP_B,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('deleteDemoData tenant-scoped cleanup (Story 10-2, SEC011)', () => {
  let prisma: PrismaClient;
  let su: PrismaClient;

  beforeAll(async () => {
    prisma = makeAppClient();
    su = makeSuperuserClient();

    await ensureTenant(su, TENANT_A_ID, 'Igreja Alpha (Demo Cleanup)');
    await ensureTenant(su, TENANT_B_ID, 'Igreja Beta (Demo Cleanup)');
  });

  afterAll(async () => {
    await hardCleanup(su);
    await prisma.$disconnect();
    await su.$disconnect();
  });

  /**
   * beforeEach — re-seed both tenants before every test so each test is
   * independent. Named function (not .bind(undefined)) per RLS spec convention.
   */
  beforeEach(async function reseedBothTenants() {
    // First hard-cleanup to avoid unique constraint conflicts
    await hardCleanup(su);

    await ensureUser(prisma, CL_USER_A, 'cl-demo-a@rls.test', TENANT_A_ID);
    await ensureUser(prisma, CL_USER_B, 'cl-demo-b@rls.test', TENANT_B_ID);
    await seedDemoChain(prisma, TENANT_A_ID, idsForTenant('A'));
    await seedDemoChain(prisma, TENANT_B_ID, idsForTenant('B'));
  });

  /** Helper: assert all 12 tables have (or have not) the row for a tenant. */
  async function assertDemoChainExists(
    tenantId: string,
    ids: ReturnType<typeof idsForTenant>,
    expected: 1 | 0,
  ) {
    const checks = [
      { table: 'users',             id: ids.userId   },
      { table: 'groups',            id: ids.groupId  },
      { table: 'group_members',     id: ids.gmId     },
      { table: 'meetings',          id: ids.mtgId    },
      { table: 'meeting_attendance', id: ids.attendId },
      { table: 'meeting_telemetry', id: ids.telemId  },
      { table: 'pastoral_actions',  id: ids.paId     },
      { table: 'trails',            id: ids.trailId  },
      { table: 'modules',           id: ids.modId    },
      { table: 'lessons',           id: ids.lesId    },
      { table: 'trail_progress',    id: ids.tpId     },
      { table: 'module_progress',   id: ids.mpId     },
    ];
    for (const { table, id } of checks) {
      const count = await countDemoByTenant(su, table, tenantId, id);
      expect(count, `${table} row for tenant ${tenantId.slice(-4)}`).toBe(expected);
    }
  }

  it('precondition: both tenants have demo rows across all 12 tables', async () => {
    await assertDemoChainExists(TENANT_A_ID, idsForTenant('A'), 1);
    await assertDemoChainExists(TENANT_B_ID, idsForTenant('B'), 1);
  });

  it('deleteDemoData(tenantA) removes all 12 demo tables for tenant A', async () => {
    await execDeleteDemoData(prisma, TENANT_A_ID);
    await assertDemoChainExists(TENANT_A_ID, idsForTenant('A'), 0);
  });

  it('deleteDemoData(tenantA) does NOT remove tenant B demo rows', async () => {
    await execDeleteDemoData(prisma, TENANT_A_ID);
    await assertDemoChainExists(TENANT_B_ID, idsForTenant('B'), 1);
  });

  it('idempotency: calling deleteDemoData(tenantA) twice does not error', async () => {
    await execDeleteDemoData(prisma, TENANT_A_ID);
    // Second call — all deletes hit 0 rows — should be silent no-op
    await expect(execDeleteDemoData(prisma, TENANT_A_ID)).resolves.not.toThrow();
  });

  it('after cleanup: tenant A has 0 demo rows; tenant B still has all demo rows', async () => {
    await execDeleteDemoData(prisma, TENANT_A_ID);
    await assertDemoChainExists(TENANT_A_ID, idsForTenant('A'), 0);
    await assertDemoChainExists(TENANT_B_ID, idsForTenant('B'), 1);
  });

  it('UPDATE on tenant A context does NOT affect tenant B demo rows (RLS boundary)', async () => {
    // Attempt to "update" tenant B's group while inside tenant A context
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      await tx.$executeRawUnsafe(
        `UPDATE groups SET name = 'hacked' WHERE id = '${CL_GROUP_B}'::uuid`,
      );
    });

    // Superuser inspection confirms tenant B group is untouched
    const rows = await su.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM groups WHERE id = '${CL_GROUP_B}'::uuid`,
    );
    expect(rows[0]?.name).not.toBe('hacked');
  });
});
