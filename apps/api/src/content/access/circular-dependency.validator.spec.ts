import { describe, it, expect, vi } from 'vitest';
import { CircularDependencyValidator } from './circular-dependency.validator';

// ---------------------------------------------------------------------------
// Mock transaction
// ---------------------------------------------------------------------------

type MockTx = {
  modulePrerequisite: { findMany: ReturnType<typeof vi.fn> };
};

function makeMockTx(graph: Record<string, string[]>): MockTx {
  // graph[moduleId] = [prereq1, prereq2, ...]
  return {
    modulePrerequisite: {
      findMany: vi.fn(({ where }: { where: { moduleId: string } }) => {
        const prereqs = graph[where.moduleId] ?? [];
        return Promise.resolve(prereqs.map((id) => ({ prerequisiteModuleId: id })));
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CircularDependencyValidator', () => {
  const validator = new CircularDependencyValidator();

  it('isSelfReference returns true when ids are equal', () => {
    expect(validator.isSelfReference('mod-A', 'mod-A')).toBe(true);
  });

  it('isSelfReference returns false when ids differ', () => {
    expect(validator.isSelfReference('mod-A', 'mod-B')).toBe(false);
  });

  it('no cycle in empty graph', async () => {
    const tx = makeMockTx({});
    // Adding A as prereq of B — no existing edges
    expect(await validator.wouldCreateCycle(tx as never, 'mod-B', 'mod-A')).toBe(false);
  });

  it('direct cycle: A→B, adding B→A creates cycle', async () => {
    // Existing: B requires A (A is prereq of B)
    // Now trying to add: A requires B (B is prereq of A) — cycle A→B→A
    const tx = makeMockTx({ 'mod-B': ['mod-A'] }); // B's prereqs = [A]
    expect(await validator.wouldCreateCycle(tx as never, 'mod-A', 'mod-B')).toBe(true);
  });

  it('no cycle when chain is linear A→B→C, adding D→C', async () => {
    // Existing: C requires B, B requires A
    const tx = makeMockTx({ 'mod-C': ['mod-B'], 'mod-B': ['mod-A'] });
    // Adding D requires C — no cycle because D is not reachable from C
    expect(await validator.wouldCreateCycle(tx as never, 'mod-D', 'mod-C')).toBe(false);
  });

  it('indirect cycle: A→B→C, adding C→A creates cycle', async () => {
    // Existing: B requires A, C requires B
    const tx = makeMockTx({ 'mod-B': ['mod-A'], 'mod-C': ['mod-B'] });
    // Adding A requires C — creates A→C→B→A cycle? Let's check from C's side
    // wouldCreateCycle(tx, 'mod-A', 'mod-C') means: does mod-C reach mod-A?
    // BFS from mod-C: C → mod-B (prereq of C) → mod-A (prereq of B) → found mod-A!
    expect(await validator.wouldCreateCycle(tx as never, 'mod-A', 'mod-C')).toBe(true);
  });

  it('no false positive for parallel prereqs', async () => {
    // A requires X; B requires X (X is prereq of both A and B)
    // Adding B as prereq of C (C→B): no cycle because X does not reach C
    const tx = makeMockTx({ 'mod-A': ['mod-X'], 'mod-B': ['mod-X'] });
    expect(await validator.wouldCreateCycle(tx as never, 'mod-C', 'mod-B')).toBe(false);
  });
});
