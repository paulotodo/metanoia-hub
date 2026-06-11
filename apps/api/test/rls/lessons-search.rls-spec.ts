/**
 * RLS Isolation spec: full-text search over lessons
 * Story 8-8 — busca full-text de trilhas e aulas
 *
 * Pattern: Prisma v7 PrismaPg adapter; UUIDs hex fixos;
 * users globais (no tenant_id FK); SET LOCAL per transaction.
 * reflections.rls flaky → rerun on FK P2003.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TENANT_A_ID, TENANT_B_ID } from './rls-test.helper';

// ─── Fixed UUIDs ──────────────────────────────────────────────────────────────

// Tenant A chain: trail → module → lesson (published + search_vector)
const TRAIL_A_PUB_ID     = '01975708-0001-7000-8000-0000000a0001';
const MODULE_A_PUB_ID    = '01975708-0001-7000-8000-0000000a0002';
const LESSON_A_PUB_ID    = '01975708-0001-7000-8000-0000000a0003';

// Tenant A: draft trail
const TRAIL_A_DFT_ID     = '01975708-0001-7000-8000-0000000a0004';
const MODULE_A_DFT_ID    = '01975708-0001-7000-8000-0000000a0005';
const LESSON_A_DFT_ID    = '01975708-0001-7000-8000-0000000a0006';

// Tenant A: soft-deleted lesson
const TRAIL_A_DEL_ID     = '01975708-0001-7000-8000-0000000a0007';
const MODULE_A_DEL_ID    = '01975708-0001-7000-8000-0000000a0008';
const LESSON_A_DEL_ID    = '01975708-0001-7000-8000-0000000a0009';

// Tenant B chain: published + draft + soft-deleted
const TRAIL_B_PUB_ID     = '01975708-0001-7000-8000-0000000b0001';
const MODULE_B_PUB_ID    = '01975708-0001-7000-8000-0000000b0002';
const LESSON_B_PUB_ID    = '01975708-0001-7000-8000-0000000b0003';
const TRAIL_B_DFT_ID     = '01975708-0001-7000-8000-0000000b0004';
const MODULE_B_DFT_ID    = '01975708-0001-7000-8000-0000000b0005';
const LESSON_B_DFT_ID    = '01975708-0001-7000-8000-0000000b0006';
const TRAIL_B_DEL_ID     = '01975708-0001-7000-8000-0000000b0007';
const MODULE_B_DEL_ID    = '01975708-0001-7000-8000-0000000b0008';
const LESSON_B_DEL_ID    = '01975708-0001-7000-8000-0000000b0009';

// Users (global — no tenant FK)
const USER_A_ID          = '01975708-0001-7000-8000-0000000a0099';
const USER_B_ID          = '01975708-0001-7000-8000-0000000b0099';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function ensureUser(prisma: PrismaClient, userId: string, label: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, name, status, updated_at)
     VALUES ('${userId}'::uuid, 'search-rls-${label}@test.com', 'Search RLS User', 'active', now())
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function seedChain(
  prisma: PrismaClient,
  opts: {
    tenantId: string;
    trailId: string;
    moduleId: string;
    lessonId: string;
    userId: string;
    trailStatus?: string;
    lessonName?: string;
    softDeleteLesson?: boolean;
  },
) {
  const {
    tenantId,
    trailId,
    moduleId,
    lessonId,
    userId,
    trailStatus = 'published',
    lessonName = 'busca-test-lesson',
    softDeleteLesson = false,
  } = opts;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    await tx.$executeRawUnsafe(
      `INSERT INTO trails (id, tenant_id, name, status, created_by, updated_at)
       VALUES ('${trailId}'::uuid, '${tenantId}'::uuid, 'trail-search-rls', '${trailStatus}', '${userId}'::uuid, now())
       ON CONFLICT (id) DO NOTHING`,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO modules (id, tenant_id, trail_id, name, "order", updated_at)
       VALUES ('${moduleId}'::uuid, '${tenantId}'::uuid, '${trailId}'::uuid, 'mod-search-rls', 0, now())
       ON CONFLICT (id) DO NOTHING`,
    );
    const deletedAtSql = softDeleteLesson ? `now()` : `NULL`;
    await tx.$executeRawUnsafe(
      `INSERT INTO lessons (id, tenant_id, module_id, name, content_type, "order", updated_at, deleted_at, tags)
       VALUES (
         '${lessonId}'::uuid, '${tenantId}'::uuid, '${moduleId}'::uuid,
         '${lessonName}', 'rich_text', 0, now(), ${deletedAtSql},
         ARRAY['busca', 'rls', 'teste']
       )
       ON CONFLICT (id) DO NOTHING`,
    );
    // Manually set search_vector (trigger runs on INSERT/UPDATE — ensure populated)
    if (!softDeleteLesson) {
      await tx.$executeRawUnsafe(
        `UPDATE lessons
         SET search_vector = to_tsvector('pg_catalog.portuguese', unaccent(name || ' ' || array_to_string(tags, ' ')))
         WHERE id = '${lessonId}'::uuid AND deleted_at IS NULL`,
      );
    }
  });
}

/**
 * Execute search query for a tenant via raw SQL (mirrors service logic).
 * Returns lesson IDs that match the term.
 */
async function searchLessons(
  prisma: PrismaClient,
  tenantId: string,
  term: string,
  includeDraft: boolean,
): Promise<string[]> {
  const tsQueryTerm = term.split(/\s+/).filter(Boolean).map((w) => `${w}:*`).join(' & ');

  const rows = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    const draftFilter = includeDraft ? '' : `AND t.status != 'draft'`;
    const result = await tx.$queryRawUnsafe<{ lesson_id: string }[]>(
      `SELECT l.id AS lesson_id
       FROM lessons l
       JOIN modules m ON m.id = l.module_id AND m.deleted_at IS NULL
       JOIN trails  t ON t.id = m.trail_id  AND t.deleted_at IS NULL
       WHERE l.deleted_at IS NULL
         ${draftFilter}
         AND l.search_vector @@ to_tsquery('pg_catalog.portuguese', unaccent('${tsQueryTerm}'))
       ORDER BY l.id`,
    );
    return result;
  });

  return rows.map((r) => r.lesson_id);
}

async function cleanup(prisma: PrismaClient) {
  const lessonIds = [
    LESSON_A_PUB_ID, LESSON_A_DFT_ID, LESSON_A_DEL_ID,
    LESSON_B_PUB_ID, LESSON_B_DFT_ID, LESSON_B_DEL_ID,
  ];
  const moduleIds = [
    MODULE_A_PUB_ID, MODULE_A_DFT_ID, MODULE_A_DEL_ID,
    MODULE_B_PUB_ID, MODULE_B_DFT_ID, MODULE_B_DEL_ID,
  ];
  const trailIds = [
    TRAIL_A_PUB_ID, TRAIL_A_DFT_ID, TRAIL_A_DEL_ID,
    TRAIL_B_PUB_ID, TRAIL_B_DFT_ID, TRAIL_B_DEL_ID,
  ];

  for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
      for (const id of lessonIds) {
        await tx.$executeRawUnsafe(`DELETE FROM lessons WHERE id = '${id}'::uuid`);
      }
      for (const id of moduleIds) {
        await tx.$executeRawUnsafe(`DELETE FROM modules WHERE id = '${id}'::uuid`);
      }
      for (const id of trailIds) {
        await tx.$executeRawUnsafe(`DELETE FROM trails WHERE id = '${id}'::uuid`);
      }
    });
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RLS Isolation: lessons full-text search (Story 8-8)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_APP_URL!;
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    await prisma.$connect();

    await ensureTenant(prisma, TENANT_A_ID, 'Tenant A Search');
    await ensureTenant(prisma, TENANT_B_ID, 'Tenant B Search');
    await ensureUser(prisma, USER_A_ID, 'a');
    await ensureUser(prisma, USER_B_ID, 'b');

    // Seed all chains
    await seedChain(prisma, {
      tenantId: TENANT_A_ID, trailId: TRAIL_A_PUB_ID,
      moduleId: MODULE_A_PUB_ID, lessonId: LESSON_A_PUB_ID,
      userId: USER_A_ID, lessonName: 'busca-test-lesson-a-pub',
    });
    await seedChain(prisma, {
      tenantId: TENANT_A_ID, trailId: TRAIL_A_DFT_ID,
      moduleId: MODULE_A_DFT_ID, lessonId: LESSON_A_DFT_ID,
      userId: USER_A_ID, trailStatus: 'draft', lessonName: 'busca-test-lesson-a-dft',
    });
    await seedChain(prisma, {
      tenantId: TENANT_A_ID, trailId: TRAIL_A_DEL_ID,
      moduleId: MODULE_A_DEL_ID, lessonId: LESSON_A_DEL_ID,
      userId: USER_A_ID, softDeleteLesson: true, lessonName: 'busca-test-lesson-a-del',
    });
    await seedChain(prisma, {
      tenantId: TENANT_B_ID, trailId: TRAIL_B_PUB_ID,
      moduleId: MODULE_B_PUB_ID, lessonId: LESSON_B_PUB_ID,
      userId: USER_B_ID, lessonName: 'busca-test-lesson-b-pub',
    });
    await seedChain(prisma, {
      tenantId: TENANT_B_ID, trailId: TRAIL_B_DFT_ID,
      moduleId: MODULE_B_DFT_ID, lessonId: LESSON_B_DFT_ID,
      userId: USER_B_ID, trailStatus: 'draft', lessonName: 'busca-test-lesson-b-dft',
    });
    await seedChain(prisma, {
      tenantId: TENANT_B_ID, trailId: TRAIL_B_DEL_ID,
      moduleId: MODULE_B_DEL_ID, lessonId: LESSON_B_DEL_ID,
      userId: USER_B_ID, softDeleteLesson: true, lessonName: 'busca-test-lesson-b-del',
    });
  });

  beforeEach(async () => {
    // No mutable data between tests — seed is stable (beforeAll). No-op cleanup.
  });

  afterAll(async () => {
    await cleanup(prisma);
    await prisma.$disconnect();
  });

  it('Teste 1 — isolamento cross-tenant: busca tenant A retorna APENAS lessons do tenant A', async () => {
    const ids = await searchLessons(prisma, TENANT_A_ID, 'busca', true);

    // Published A visible
    expect(ids).toContain(LESSON_A_PUB_ID);
    // Draft A visible (includeDraft=true for leaders)
    expect(ids).toContain(LESSON_A_DFT_ID);
    // Tenant B lessons NEVER visible
    expect(ids).not.toContain(LESSON_B_PUB_ID);
    expect(ids).not.toContain(LESSON_B_DFT_ID);
    expect(ids).not.toContain(LESSON_B_DEL_ID);
    // Soft-deleted never appears
    expect(ids).not.toContain(LESSON_A_DEL_ID);
  });

  it('Teste 2 — isolamento reverso: busca tenant B retorna APENAS lessons do tenant B', async () => {
    const ids = await searchLessons(prisma, TENANT_B_ID, 'busca', true);

    expect(ids).toContain(LESSON_B_PUB_ID);
    expect(ids).toContain(LESSON_B_DFT_ID);
    expect(ids).not.toContain(LESSON_A_PUB_ID);
    expect(ids).not.toContain(LESSON_A_DFT_ID);
    expect(ids).not.toContain(LESSON_A_DEL_ID);
    expect(ids).not.toContain(LESSON_B_DEL_ID);
  });

  it('Teste 3 — soft-deleted nunca aparece em nenhum tenant', async () => {
    const idsA = await searchLessons(prisma, TENANT_A_ID, 'busca', true);
    const idsB = await searchLessons(prisma, TENANT_B_ID, 'busca', true);

    expect(idsA).not.toContain(LESSON_A_DEL_ID);
    expect(idsA).not.toContain(LESSON_B_DEL_ID);
    expect(idsB).not.toContain(LESSON_A_DEL_ID);
    expect(idsB).not.toContain(LESSON_B_DEL_ID);
  });

  it('Teste 4a — draft: participante não vê aulas de trilhas draft', async () => {
    // includeDraft=false simulates participante filter (t.status != draft)
    const ids = await searchLessons(prisma, TENANT_A_ID, 'busca', false);

    expect(ids).toContain(LESSON_A_PUB_ID);
    expect(ids).not.toContain(LESSON_A_DFT_ID);
    expect(ids).not.toContain(LESSON_A_DEL_ID);
  });

  it('Teste 4b — draft: líder/admin vê aulas de trilha draft (is_draft flag validated by service)', async () => {
    // includeDraft=true simulates leader/admin filter
    const ids = await searchLessons(prisma, TENANT_A_ID, 'busca', true);

    expect(ids).toContain(LESSON_A_DFT_ID);
    expect(ids).toContain(LESSON_A_PUB_ID);
  });

  it('Confirma pattern NULLIF: RLS policy usa current_setting app.current_tenant_id', async () => {
    // Cross-tenant isolation IS the proof that NULLIF pattern works correctly.
    // Tenant A cannot see Tenant B — verified in Teste 1 and 2.
    // This test explicitly verifies search returns empty when tenant context is not set.
    const rows = await prisma.$queryRawUnsafe<{ lesson_id: string }[]>(
      `SELECT l.id AS lesson_id
       FROM lessons l
       WHERE l.name LIKE 'busca-test-lesson%'
       LIMIT 100`,
    );
    // Without SET LOCAL, RLS blocks all rows (empty set) — correct RLS enforcement
    expect(rows).toHaveLength(0);
  });
});
