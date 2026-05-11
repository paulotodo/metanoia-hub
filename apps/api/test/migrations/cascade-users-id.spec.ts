import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { uuidv7 } from 'uuidv7';

/**
 * Integration test guarding `ON UPDATE CASCADE` on every FK that references
 * `users.id`. Story 7-4 introduced `realignPgUserId` to bring `users.id` in
 * line with the Keycloak `user_id` claim after OAuth onboarding — that path
 * silently depends on CASCADE. Without it, the UPDATE either fails with a FK
 * constraint violation OR (worse) leaves dangling rows in `consents`,
 * `user_tenants`, etc.
 *
 * This test reads the live schema from `pg_catalog.pg_constraint` and
 * asserts the invariant. Any future migration that adds a new FK without
 * CASCADE will trip it. (Note: we use pg_catalog rather than
 * information_schema because the latter is filtered by role privilege —
 * `metanoia_app` does not own the constraints and gets an empty view.)
 */

const REQUIRED_TABLES = [
  'consents',
  'group_members',
  'user_tenants',
  'pastoral_alerts',
  'pastoral_actions',
  'pastoral_notes',
];

const TENANT_ID = '019e1000-0000-7000-8000-000000000aaa';

// pg_catalog.pg_constraint.confupdtype encoding:
//   'a' = NO ACTION, 'r' = RESTRICT, 'c' = CASCADE,
//   'n' = SET NULL, 'd' = SET DEFAULT
const CASCADE = 'c';

describe('Migration invariant: ON UPDATE CASCADE on FK -> users.id', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    const connectionString = process.env.DATABASE_APP_URL;
    if (!connectionString) {
      throw new Error('DATABASE_APP_URL missing — start docker-compose first');
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('every FK that references users(id) has update_rule = CASCADE', async () => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        conname: string;
        table_name: string;
        confupdtype: string;
      }>
    >(`
      SELECT conname::text AS conname,
             conrelid::regclass::text AS table_name,
             confupdtype::text AS confupdtype
      FROM pg_catalog.pg_constraint
      WHERE contype = 'f'
        AND confrelid = 'public.users'::regclass
      ORDER BY conrelid::regclass::text
    `);

    expect(rows.length).toBeGreaterThan(0);

    const offenders = rows.filter((r) => r.confupdtype !== CASCADE);
    if (offenders.length > 0) {
      const list = offenders
        .map((r) => `${r.table_name} (${r.conname}) -> confupdtype=${r.confupdtype}`)
        .join('\n  - ');
      throw new Error(
        `FKs to users.id without ON UPDATE CASCADE — Story 7-4 realignPgUserId would break:\n  - ${list}`,
      );
    }

    // Sanity floor: ensure discovery matched the known reference tables
    const seen = new Set(rows.map((r) => r.table_name));
    for (const table of REQUIRED_TABLES) {
      expect(seen.has(table)).toBe(true);
    }
  });

  it('UPDATE users SET id = ... propagates to dependent rows via CASCADE', async () => {
    const oldUserId = uuidv7();
    const newUserId = uuidv7();
    const tenantId = TENANT_ID;
    const consentId = uuidv7();
    const userTenantId = uuidv7();

    try {
      // Seed: tenant + user + dependent rows in two tables
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${tenantId}'`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO tenants (id, tenant_id, name)
           VALUES ('${tenantId}'::uuid, '${tenantId}'::uuid, 'Cascade Spec Tenant')
           ON CONFLICT (id) DO NOTHING`,
        );
        await tx.user.create({
          data: {
            id: oldUserId,
            email: `cascade-${oldUserId}@test.local`,
            name: 'Cascade User',
            status: 'active',
            tenantId: null,
          },
        });
        await tx.userTenant.create({
          data: {
            id: userTenantId,
            userId: oldUserId,
            tenantId,
            role: 'participant',
          },
        });
        await tx.consent.create({
          data: {
            id: consentId,
            userId: oldUserId,
            tenantId,
            documentType: 'tos',
            version: 'v-cascade',
            ipAddress: '127.0.0.1',
            userAgent: 'cascade-spec',
          },
        });
      });

      // Realign user id via raw UPDATE — mirror of realignPgUserId.
      // Wrapped in a transaction with SET LOCAL because the legacy
      // users_tenant_isolation RLS policy fails on `''::uuid` cast when
      // current_setting is missing (Task 4 will consolidate this).
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${tenantId}'`,
        );
        await tx.$executeRawUnsafe(
          `UPDATE users SET id = '${newUserId}'::uuid WHERE id = '${oldUserId}'::uuid`,
        );
      });

      // Read dependent rows under the tenant context — they must carry the
      // new id thanks to ON UPDATE CASCADE
      const after = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${tenantId}'`,
        );
        const userTenant = await tx.userTenant.findUnique({
          where: { id: userTenantId },
        });
        const consent = await tx.consent.findUnique({
          where: { id: consentId },
        });
        return { userTenant, consent };
      });

      expect(after.userTenant?.userId).toBe(newUserId);
      expect(after.consent?.userId).toBe(newUserId);
    } finally {
      // Cleanup — delete_rule is RESTRICT on these FKs, so we must remove
      // child rows before the user. Run under the tenant context so RLS
      // policies admit the DELETEs.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${tenantId}'`,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM consents WHERE id = '${consentId}'::uuid`,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM user_tenants WHERE id = '${userTenantId}'::uuid`,
        );
      });
      // Users DELETE also needs the tenant context until Task 4
      // (RLS NULLIF consolidation) lands — the legacy users_tenant_isolation
      // policy (migration 20260413) casts `''::uuid` and throws otherwise.
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${tenantId}'`,
        );
        await tx.$executeRawUnsafe(
          `DELETE FROM users WHERE id IN ('${oldUserId}'::uuid, '${newUserId}'::uuid)`,
        );
      });
    }
  });
});
