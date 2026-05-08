import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Story 7-2 — Structural guards on the unified demo seed.
 *
 * The seed needs a real database to run end-to-end, so this spec parses the
 * source file and asserts the *contract* the radar UI relies on:
 *   - exactly the documented status distribution (4 verde / 3 amarelo / 2 vermelho / 1 novo)
 *   - all rows wired to the demo tenant constant
 *   - upsert-only writes (idempotency precondition — no `.create({` calls)
 */

const SEED_PATH = join(__dirname, '../../prisma/seeds/demo-seed.ts');
const SEED_SRC = readFileSync(SEED_PATH, 'utf-8');

function countMatches(haystack: string, needle: RegExp): number {
  return haystack.match(needle)?.length ?? 0;
}

describe('demo-seed (Story 7-2)', () => {
  it('flags the demo tenant with isDemo:true', () => {
    expect(SEED_SRC).toMatch(/isDemo:\s*true/);
  });

  it('exposes the demo tenant id constant', () => {
    expect(SEED_SRC).toMatch(/DEMO_TENANT_ID\s*=\s*'019899a0-7002-7000-8000-000000000001'/);
  });

  it('seeds exactly 10 participants with the documented status distribution', () => {
    expect(countMatches(SEED_SRC, /status:\s*'verde'/g)).toBe(4);
    expect(countMatches(SEED_SRC, /status:\s*'amarelo'/g)).toBe(3);
    expect(countMatches(SEED_SRC, /status:\s*'vermelho'/g)).toBe(2);
    expect(countMatches(SEED_SRC, /status:\s*'novo'/g)).toBe(1);
  });

  it('uses Brazilian-style names (no generic User N placeholders)', () => {
    expect(SEED_SRC).toMatch(/Maria Santos/);
    expect(SEED_SRC).toMatch(/João Oliveira/);
    expect(SEED_SRC).toMatch(/Ana Costa/);
    expect(SEED_SRC).not.toMatch(/User\s*\d/);
    expect(SEED_SRC).not.toMatch(/Test User/i);
  });

  it('only writes via upsert (idempotency precondition)', () => {
    // No bare `.create(` — Prisma create() bypasses upsert and would dup on rerun.
    expect(SEED_SRC).not.toMatch(/prisma\.\w+\.create\(/);
    // At least one upsert per model touched (tenant/user/group/meeting/alerts/...)
    expect(countMatches(SEED_SRC, /\.upsert\(/g)).toBeGreaterThanOrEqual(8);
  });

  it('records exactly 3 historical meetings', () => {
    expect(countMatches(SEED_SRC, /daysBack:\s*21/g)).toBe(1);
    expect(countMatches(SEED_SRC, /daysBack:\s*14/g)).toBe(1);
    expect(countMatches(SEED_SRC, /daysBack:\s*7/g)).toBe(1);
  });

  it('records 2 pastoral actions covering urgent + attention signals', () => {
    expect(SEED_SRC).toMatch(/signalType:\s*'care-urgent'/);
    expect(SEED_SRC).toMatch(/signalType:\s*'care-attention'/);
  });

  it('attaches all rows to DEMO_TENANT_ID via the constant (no string drift)', () => {
    // No hard-coded copies of the tenant UUID outside the constant declaration.
    const literalCount = countMatches(
      SEED_SRC,
      /'019899a0-7002-7000-8000-000000000001'/g,
    );
    expect(literalCount).toBe(1);
  });
});
