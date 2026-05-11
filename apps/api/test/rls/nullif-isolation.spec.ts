import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Guards the NULLIF invariant set up by migration
 * `20260510210000_consolidate_rls_nullif`. Every tenant-scoped USING clause
 * across the schema must read
 * `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` so a
 * query without SET LOCAL returns zero rows instead of raising
 * `invalid input syntax for type uuid: ""` (the failure mode tripped by
 * Story 7-4 bug log #14/#15/#17).
 *
 * Story 7-5 (Task 4) consolidated all variants to the NULLIF form. This
 * spec runs alongside the migration and prevents regression: any new
 * migration that adds a USING clause without NULLIF will trip it.
 */

/**
 * Tables with NOT NULL tenant_id — policy must filter out everything when
 * the setting is missing.
 */
const NOT_NULL_TENANT_TABLES = [
  'pastoral_actions',
  'pastoral_alerts',
  'pastoral_notes',
  'tenants',
  'meeting_events',
  'user_tenants',
  'groups',
  'group_members',
  'meetings',
  'meeting_participants',
  'outreach_intents',
  'reflections',
];

/**
 * Tables with nullable tenant_id — policy admits `tenant_id IS NULL` so the
 * count may be non-zero, but the SELECT must still NOT raise.
 */
const NULLABLE_TENANT_TABLES = ['users', 'consents', 'invites'];

describe('RLS NULLIF invariant (migration 20260510210000)', () => {
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

  it('every USING clause that reads current_setting uses NULLIF', async () => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        polname: string;
        table_name: string;
        using_clause: string;
      }>
    >(`
      SELECT polname::text AS polname,
             conrel.relname::text AS table_name,
             pg_get_expr(polqual, polrelid)::text AS using_clause
      FROM pg_policy
      JOIN pg_class conrel ON conrel.oid = polrelid
      WHERE pg_get_expr(polqual, polrelid) LIKE '%current_setting%'
        AND pg_get_expr(polqual, polrelid) NOT LIKE '%NULLIF%'
        AND conrel.relkind = 'r'
    `);

    if (rows.length > 0) {
      const list = rows
        .map((r) => `${r.table_name}.${r.polname} → ${r.using_clause}`)
        .join('\n  - ');
      throw new Error(
        `RLS policies with current_setting() but no NULLIF guard found:\n  - ${list}`,
      );
    }
    expect(rows).toEqual([]);
  });

  it.each(NOT_NULL_TENANT_TABLES)(
    'SELECT FROM %s without SET LOCAL returns 0 rows (no SQL error)',
    async (table) => {
      // Query without setting app.current_tenant_id. Pre-Story-7-5 this would
      // raise SQLSTATE 22P02 on `''::uuid`; post-migration the NULLIF form
      // turns the cast into NULL and the policy filter excludes all rows.
      const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*)::bigint AS count FROM ${table}`,
      );
      expect(rows[0]?.count).toBe(0n);
    },
  );

  it.each(NULLABLE_TENANT_TABLES)(
    'SELECT FROM %s without SET LOCAL does not throw (nullable tenant_id)',
    async (table) => {
      // Tables with nullable tenant_id admit `tenant_id IS NULL` rows so the
      // count may be non-zero, but the query must still NOT raise on the
      // `''::uuid` cast. We just confirm no exception bubbles up.
      await expect(
        prisma.$queryRawUnsafe(`SELECT count(*) FROM ${table}`),
      ).resolves.toBeDefined();
    },
  );
});
