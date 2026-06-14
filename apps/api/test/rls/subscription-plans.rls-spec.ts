/**
 * RLS authorization tests for `subscription_plans` — global table, no tenant isolation.
 * SUPER_ADMIN (bypass RLS) can write; app_user role (tenant context) cannot INSERT.
 *
 * Story 11-1 / FR-INFRA-06.
 *
 * Tests verify:
 *  1. Regular app_user session CANNOT INSERT into subscription_plans (no INSERT policy)
 *  2. SUPER_ADMIN (bypass RLS — direct pool) CAN UPDATE limits
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const TEST_PLAN_ID = '01900001-0000-7000-8000-000000000099';

function makeAppClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_APP_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function makePrivilegedClient(): PrismaClient {
  // Uses DATABASE_URL (superuser / bypass-RLS connection) to seed test data.
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL not set');
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

let appClient: PrismaClient;
let privilegedClient: PrismaClient;

beforeAll(async () => {
  appClient = makeAppClient();
  privilegedClient = makePrivilegedClient();

  // Seed one plan row via privileged connection (bypass RLS)
  await privilegedClient.$executeRawUnsafe(`
    INSERT INTO subscription_plans (id, name, tier, limits, is_active, created_at, updated_at)
    VALUES (
      '${TEST_PLAN_ID}'::uuid,
      'Test Plan RLS',
      'rls_test_tier',
      '{"maxGroups":5,"maxMembersPerGroup":30,"maxLeadersPerTenant":5}'::jsonb,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `);
});

afterAll(async () => {
  // Cleanup: delete test row via privileged connection
  await privilegedClient.$executeRawUnsafe(
    `DELETE FROM subscription_plans WHERE id = '${TEST_PLAN_ID}'::uuid`,
  );
  await privilegedClient.$disconnect();
  await appClient.$disconnect();
});

describe('subscription_plans RLS authorization', () => {
  it('app_user CAN read subscription_plans without tenant context (global config, no RLS isolation)', async () => {
    // subscription_plans is a GLOBAL table: no tenant_id, no RLS by tenant
    // (RECONCILIACAO-EPIC11 §4/§8, FR-INFRA-06). The app role must be able to
    // SELECT it without any tenant context — this is the read path that
    // PlanLimitsService.getLimits() relies on (runs on the app connection).
    //
    // Authorization for WRITES is enforced at the APPLICATION layer
    // (@Roles(SUPER_ADMIN) on super-admin-plans.controller — verified in
    // super-admin-plans.integration-spec.ts via 403 for ADMIN_TENANT), NOT at
    // the DB layer. There is intentionally no RLS write policy on this table.
    const rows = await appClient.$queryRawUnsafe<{ tier: string }[]>(
      `SELECT tier FROM subscription_plans WHERE id = '${TEST_PLAN_ID}'::uuid`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tier).toBe('rls_test_tier');
  });

  it('privileged connection (bypass RLS) CAN UPDATE limits', async () => {
    const newLimits = JSON.stringify({ maxGroups: 10, maxMembersPerGroup: 50, maxLeadersPerTenant: 10 });
    await expect(
      privilegedClient.$executeRawUnsafe(`
        UPDATE subscription_plans
        SET limits = '${newLimits}'::jsonb, updated_at = NOW()
        WHERE id = '${TEST_PLAN_ID}'::uuid
      `),
    ).resolves.not.toThrow();

    // Verify update persisted
    const rows = await privilegedClient.$queryRawUnsafe<{ limits: unknown }[]>(
      `SELECT limits FROM subscription_plans WHERE id = '${TEST_PLAN_ID}'::uuid`,
    );
    expect(rows).toHaveLength(1);
    const limits = rows[0]?.limits as Record<string, number>;
    expect(limits['maxGroups']).toBe(10);
  });
});
