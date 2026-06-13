import { describe, it, expect, vi } from 'vitest';
import { ProgressService } from '../progress.service';

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const TRAIL_ID = '01912345-6789-7000-8000-000000000030';
const LESSON_ID = '01912345-6789-7000-8000-000000000031';

function makePrisma(trailProgressRows: unknown[], trails: unknown[], lessonProgressRows: unknown[], lessons: unknown[]) {
  return {
    client: {
      trailProgress: { findMany: vi.fn().mockResolvedValue(trailProgressRows) },
      trail: { findMany: vi.fn().mockResolvedValue(trails) },
      lessonProgress: { findMany: vi.fn().mockResolvedValue(lessonProgressRows) },
      lesson: { findMany: vi.fn().mockResolvedValue(lessons) },
    },
  };
}

function makeService(prisma: unknown) {
  return new ProgressService(
    {} as never, // bullMqService — not used by exportUserData
    prisma as never,
  );
}

describe('ProgressService.exportUserData', () => {
  it('returns trail and lesson progress with ISO 8601 dates', async () => {
    const trailRows = [
      {
        trailId: TRAIL_ID,
        progressPercent: 75,
        completedAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    ];
    const trailList = [{ id: TRAIL_ID, name: 'Discipulado Básico' }];
    const lessonRows = [
      {
        lessonId: LESSON_ID,
        status: 'completed',
        completedAt: new Date('2026-04-20T00:00:00.000Z'),
        updatedAt: new Date('2026-04-20T00:00:00.000Z'),
      },
    ];
    const lessonList = [{ id: LESSON_ID, title: 'Aula 1 — Fundamentos' }];

    const prisma = makePrisma(trailRows, trailList, lessonRows, lessonList);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.trailProgress).toHaveLength(1);
    expect(result.trailProgress[0].trailId).toBe(TRAIL_ID);
    expect(result.trailProgress[0].trailName).toBe('Discipulado Básico');
    expect(result.trailProgress[0].progressPercent).toBe(75);
    expect(result.trailProgress[0].completedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(result.trailProgress[0].updatedAt).toBe('2026-05-10T00:00:00.000Z');

    expect(result.lessonProgress).toHaveLength(1);
    expect(result.lessonProgress[0].lessonId).toBe(LESSON_ID);
    expect(result.lessonProgress[0].lessonName).toBe('Aula 1 — Fundamentos');
    expect(result.lessonProgress[0].status).toBe('completed');
    expect(result.lessonProgress[0].completedAt).toBe('2026-04-20T00:00:00.000Z');
  });

  it('maps completedAt as null when not completed', async () => {
    const trailRows = [
      {
        trailId: TRAIL_ID,
        progressPercent: 30,
        completedAt: null,
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ];
    const lessonRows = [
      {
        lessonId: LESSON_ID,
        status: 'in_progress',
        completedAt: null,
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ];
    const prisma = makePrisma(
      trailRows,
      [{ id: TRAIL_ID, name: 'Trilha' }],
      lessonRows,
      [{ id: LESSON_ID, title: 'Aula' }],
    );
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.trailProgress[0].completedAt).toBeNull();
    expect(result.lessonProgress[0].completedAt).toBeNull();
  });

  it('returns empty arrays when user has no progress', async () => {
    const prisma = makePrisma([], [], [], []);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.trailProgress).toHaveLength(0);
    expect(result.lessonProgress).toHaveLength(0);
  });

  it('skips bulk trail fetch when no trail rows', async () => {
    const prisma = makePrisma([], [], [], []);
    const svc = makeService(prisma);

    await svc.exportUserData(USER_ID, TENANT_ID);

    expect(prisma.client.trail.findMany).not.toHaveBeenCalled();
    expect(prisma.client.lesson.findMany).not.toHaveBeenCalled();
  });
});
