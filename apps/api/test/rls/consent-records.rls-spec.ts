/**
 * RLS isolation and immutability tests for `consent_records` table.
 *
 * Story 9-4 (LGPD — Base Legal & Histórico de Consentimento)
 * FR: tenant isolation (NULLIF policy), append-only immutability (no UPDATE/DELETE policies).
 *
 * Tests verify:
 *  1. Tenant A record not visible to Tenant B (isolation)
 *  2. Null tenant_id record visible to all tenants (global consent)
 *  3. UPDATE is rejected (no policy — append-only)
 *  4. DELETE is rejected (no policy — append-only)
 *
 * Pattern: PrismaPg adapter + UUIDs hex-fixed + beforeEach ensureUser.
 * Matches audit-events.rls-spec.ts pattern for consistency.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// Fresh IDs per run to avoid accumulation across CI re-runs
const USER_A_ID = generateId();
const USER_B_ID = generateId();
const USER_NULL_TENANT_ID = generateId();

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

async function ensureUser(
  prisma: PrismaClient,
  userId: string,
  email: string,
  tenantId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO users (id, email, name, status, tenant_id, created_at, updated_at)
       VALUES ('${userId}'::uuid, '${email}', 'Test User', 'active', '${tenantId}'::uuid, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  });
}

async function insertWithdrawal(
  prisma: PrismaClient,
  opts: {
    id: string;
    userId: string;
    tenantId: string | null;
    consentType?: string;
  },
): Promise<void> {
  const tid = opts.tenantId;
  await prisma.$transaction(async (tx) => {
    if (tid) {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tid}'`);
    } else {
      // null tenant: set GUC to empty string (NULLIF resolves to NULL)
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = ''`);
    }
    const tenantSql = tid ? `'${tid}'::uuid` : 'NULL';
    await tx.$executeRawUnsafe(
      `INSERT INTO consent_records (id, user_id, tenant_id, consent_type, action, timestamp)
       VALUES ('${opts.id}'::uuid, '${opts.userId}'::uuid, ${tenantSql},
               '${opts.consentType ?? 'focus_monitoring'}', 'withdrawn', NOW())`,
    );
  });
}

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = makeClient();
  await ensureTenant(prisma, TENANT_A_ID, 'Tenant RLS A — ConsentRecords');
  await ensureTenant(prisma, TENANT_B_ID, 'Tenant RLS B — ConsentRecords');
  await ensureUser(prisma, USER_A_ID, `consent-rls-a+${USER_A_ID}@test.local`, TENANT_A_ID);
  await ensureUser(prisma, USER_B_ID, `consent-rls-b+${USER_B_ID}@test.local`, TENANT_B_ID);
  await ensureUser(prisma, USER_NULL_TENANT_ID, `consent-rls-null+${USER_NULL_TENANT_ID}@test.local`, TENANT_A_ID);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Case 1: Tenant A record not visible to Tenant B
// ---------------------------------------------------------------------------

describe('RLS isolation: tenant A vs tenant B', () => {
  it('INSERT for tenant A is NOT visible when reading as tenant B', async () => {
    const recordId = generateId();
    await insertWithdrawal(prisma, {
      id: recordId,
      userId: USER_A_ID,
      tenantId: TENANT_A_ID,
      consentType: 'focus_monitoring',
    });

    // Read as tenant B — should return 0 rows
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM consent_records WHERE id = ${recordId}::uuid
      `;
    });

    expect(rows).toHaveLength(0);
  });

  it('INSERT for tenant B is NOT visible when reading as tenant A', async () => {
    const recordId = generateId();
    await insertWithdrawal(prisma, {
      id: recordId,
      userId: USER_B_ID,
      tenantId: TENANT_B_ID,
      consentType: 'focus_monitoring',
    });

    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM consent_records WHERE id = ${recordId}::uuid
      `;
    });

    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Case 2: null tenant_id — visible to all tenants (global withdrawal)
// ---------------------------------------------------------------------------

describe('RLS: null tenant_id record is visible to any tenant', () => {
  it('null tenant_id row is visible as tenant A', async () => {
    const recordId = generateId();
    await insertWithdrawal(prisma, {
      id: recordId,
      userId: USER_NULL_TENANT_ID,
      tenantId: null,
      consentType: 'focus_monitoring',
    });

    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM consent_records WHERE id = ${recordId}::uuid
      `;
    });

    expect(rows).toHaveLength(1);
  });

  it('null tenant_id row is visible as tenant B', async () => {
    const recordId = generateId();
    await insertWithdrawal(prisma, {
      id: recordId,
      userId: USER_NULL_TENANT_ID,
      tenantId: null,
      consentType: 'focus_monitoring',
    });

    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_B_ID}'`);
      return tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM consent_records WHERE id = ${recordId}::uuid
      `;
    });

    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Case 3: UPDATE rejected — no UPDATE policy (append-only)
// ---------------------------------------------------------------------------

describe('RLS immutability: UPDATE rejected', () => {
  it('UPDATE on consent_records raises exception (no UPDATE policy)', async () => {
    const recordId = generateId();
    await insertWithdrawal(prisma, {
      id: recordId,
      userId: USER_A_ID,
      tenantId: TENANT_A_ID,
      consentType: 'focus_monitoring',
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        await tx.$executeRawUnsafe(
          `UPDATE consent_records SET action = 'withdrawn' WHERE id = '${recordId}'::uuid`,
        );
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Case 4: DELETE rejected — no DELETE policy (append-only)
// ---------------------------------------------------------------------------

describe('RLS immutability: DELETE rejected', () => {
  it('DELETE on consent_records raises exception (no DELETE policy)', async () => {
    const recordId = generateId();
    await insertWithdrawal(prisma, {
      id: recordId,
      userId: USER_A_ID,
      tenantId: TENANT_A_ID,
      consentType: 'focus_monitoring',
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_A_ID}'`);
        await tx.$executeRawUnsafe(
          `DELETE FROM consent_records WHERE id = '${recordId}'::uuid`,
        );
      }),
    ).rejects.toThrow();
  });
});
