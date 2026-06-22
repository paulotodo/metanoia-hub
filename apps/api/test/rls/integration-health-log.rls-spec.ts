/**
 * RLS isolation spec — integration_health_log (Story 14-4)
 *
 * Cobertura:
 *  (a) Worker escreve via createPrivilegedClient() BYPASSRLS → registro criado
 *  (b) Leitura via cliente normal com platform_read USING(true) → dados visíveis
 *  (c) DELETE bloqueado para cliente não-privilegiado
 *
 * NFR-TEST-001: este spec bate no banco local (docker-compose.test.yml).
 * NUNCA bater em produção. Executar com: pnpm --filter api vitest test/rls/integration-health-log
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { generateId } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cliente privilegiado (BYPASSRLS) usando DATABASE_URL (superuser ou BYPASSRLS role) */
function createPrivilegedClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'] ?? 'postgresql://metanoia_su:password@localhost:5432/metanoia_test';
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Cliente de aplicação (metanoia_app — RLS ativo, sem BYPASSRLS) */
function createAppClient(): PrismaClient {
  const connectionString = process.env['DATABASE_APP_URL'] ?? 'postgresql://metanoia_app:password@localhost:5432/metanoia_test';
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

describe('integration_health_log — RLS isolation', () => {
  let privileged: PrismaClient;
  let app: PrismaClient;
  let insertedId: string;

  beforeAll(async () => {
    privileged = createPrivilegedClient();
    app = createAppClient();
  });

  afterAll(async () => {
    // Limpar registros de teste para não poluir banco de dev
    if (insertedId) {
      await privileged.$executeRawUnsafe(
        `DELETE FROM integration_health_log WHERE id = $1::uuid`,
        insertedId,
      );
    }
    await privileged.$disconnect();
    await app.$disconnect();
  });

  it('(a) worker escreve via cliente privilegiado BYPASSRLS → registro criado', async () => {
    insertedId = generateId();
    await privileged.$executeRawUnsafe(
      `INSERT INTO integration_health_log
         (id, integration_name, status, latency_ms, message, checked_at)
       VALUES ($1::uuid, $2, $3::integration_health_status, $4, $5, $6)`,
      insertedId,
      'Redis',
      'healthy',
      2,
      null,
      new Date().toISOString(),
    );

    const rows = await privileged.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id::text FROM integration_health_log WHERE id = $1::uuid`,
      insertedId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(insertedId);
  });

  it('(b) leitura via cliente normal com platform_read USING(true) → dado visível', async () => {
    // platform_read policy: USING (true) — qualquer cliente autenticado pode SELECT
    const rows = await app.$queryRawUnsafe<{ id: string; integration_name: string }[]>(
      `SELECT id::text, integration_name FROM integration_health_log WHERE id = $1::uuid`,
      insertedId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.integration_name).toBe('Redis');
  });

  it('(c) DELETE via cliente não-privilegiado é bloqueado pela RLS', async () => {
    // platform_read policy não tem FOR DELETE — qualquer DELETE via app client deve ser bloqueado
    // (tabela tem RLS habilitada mas sem política DELETE → acesso negado por padrão)
    await expect(
      app.$executeRawUnsafe(
        `DELETE FROM integration_health_log WHERE id = $1::uuid`,
        insertedId,
      ),
    ).rejects.toThrow(); // RLS block ou permission denied
  });
});
