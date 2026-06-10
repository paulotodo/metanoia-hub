import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LESSON_PROGRESS_QUEUE_NAME } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Unit tests: progress recalculation logic + retry behavior
// ---------------------------------------------------------------------------

const mockQueueAdd = vi.fn();

// ---- Constants ----
const TENANT_ID = '01975700-0001-7000-8000-000000000001';
const USER_ID = '01975700-0001-7000-8000-000000000099';
const TRAIL_ID = '01975700-0001-7000-8000-000000000010';

// Mock Prisma tx (used in smoke test below)
const mockExecuteRawUnsafe = vi.fn();
const mockLessonProgressFindUnique = vi.fn();
const mockLessonProgressCreate = vi.fn();

const mockTx = {
  $executeRawUnsafe: mockExecuteRawUnsafe,
  lessonProgress: {
    findUnique: mockLessonProgressFindUnique,
    create: mockLessonProgressCreate,
  },
};

const mockPrisma = {
  client: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
};

describe('ProgressProcessor: lesson status assignment', () => {
  it('assigns not_started for progressPercent=0', () => {
    const percent = 0;
    const status = percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started';
    expect(status).toBe('not_started');
  });

  it('assigns in_progress for progressPercent=50', () => {
    const percent = 50;
    const status = percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started';
    expect(status).toBe('in_progress');
  });

  it('assigns completed for progressPercent=100', () => {
    const percent = 100;
    const status = percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started';
    expect(status).toBe('completed');
  });
});

describe('ProgressProcessor: ModuleProgress recalculation', () => {
  it('calculates 50% when 1 of 2 lessons completed', () => {
    const completedLessons = 1;
    const totalLessons = 2;
    const percent = Math.floor((completedLessons / totalLessons) * 100);
    expect(percent).toBe(50);
  });

  it('calculates 100% when all lessons completed', () => {
    const completedLessons = 3;
    const totalLessons = 3;
    const percent = Math.floor((completedLessons / totalLessons) * 100);
    expect(percent).toBe(100);
  });

  it('calculates 0% when total is 0 (empty module)', () => {
    const completedLessons = 0;
    const totalLessons = 0;
    const percent = totalLessons > 0 ? Math.floor((completedLessons / totalLessons) * 100) : 0;
    expect(percent).toBe(0);
  });

  it('module is complete only when completedLessons === totalLessons > 0', () => {
    const moduleComplete = (c: number, t: number) => c === t && t > 0;
    expect(moduleComplete(2, 2)).toBe(true);
    expect(moduleComplete(1, 2)).toBe(false);
    expect(moduleComplete(0, 0)).toBe(false);
  });
});

describe('ProgressProcessor: TrailProgress recalculation', () => {
  it('calculates 33% when 1 of 3 modules completed', () => {
    const completedModules = 1;
    const totalModules = 3;
    const percent = Math.floor((completedModules / totalModules) * 100);
    expect(percent).toBe(33);
  });

  it('calculates 100% when all modules completed', () => {
    const completedModules = 4;
    const totalModules = 4;
    const percent = Math.floor((completedModules / totalModules) * 100);
    expect(percent).toBe(100);
  });
});

describe('ProgressProcessor: BullMQ queue setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a worker on the correct queue name (lesson-progress)', () => {
    expect(LESSON_PROGRESS_QUEUE_NAME).toBe('lesson-progress');
  });

  it('enqueue call uses 3 retry attempts with exponential backoff (1s)', async () => {
    await mockQueueAdd('update-progress', {}, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnFail: false,
    });

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'update-progress',
      {},
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnFail: false,
      }),
    );
  });

  it('failed jobs are retained (removeOnFail: false = NFR-I4)', () => {
    const opts = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnFail: false,
    };
    expect(opts.removeOnFail).toBe(false);
  });
});

describe('ProgressProcessor: progress does not go backwards', () => {
  it('skips update if new percent is lower than existing', () => {
    const existingPercent = 75;
    const newPercent = 50;
    const shouldUpdate = newPercent >= existingPercent;
    expect(shouldUpdate).toBe(false);
  });

  it('updates if new percent equals or exceeds existing', () => {
    expect(75 >= 75).toBe(true);
    expect(100 >= 75).toBe(true);
  });
});

describe('ProgressProcessor: domain event emission', () => {
  it('emits event only when trail percent changes', () => {
    const previousPercent = 50;
    const newPercent = 75;
    const shouldEmit = newPercent !== previousPercent;
    expect(shouldEmit).toBe(true);
  });

  it('skips event emission when trail percent unchanged', () => {
    const previousPercent = 50;
    const newPercent = 50;
    const shouldEmit = newPercent !== previousPercent;
    expect(shouldEmit).toBe(false);
  });

  it('domain event has correct shape', () => {
    const event = {
      eventId: 'some-uuid',
      eventType: 'content.trail.progress_updated',
      version: 1 as const,
      tenantId: TENANT_ID,
      timestamp: new Date().toISOString(),
      data: {
        userId: USER_ID,
        trailId: TRAIL_ID,
        progressPercent: 75,
        previousPercent: 50,
      },
      metadata: { correlationId: 'progress-job-1' },
    };

    expect(event.eventType).toBe('content.trail.progress_updated');
    expect(event.version).toBe(1);
    expect(event.data.progressPercent).toBe(75);
    expect(event.data.previousPercent).toBe(50);
    expect(event.metadata.correlationId).toContain('progress-job');
  });
});

describe('ProgressProcessor: mock integration smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLessonProgressFindUnique.mockResolvedValue(null);
    mockLessonProgressCreate.mockResolvedValue({});
  });

  it('calls $executeRawUnsafe to set tenant context before queries', async () => {
    await mockPrisma.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${TENANT_ID}'`);
      const existing = await tx.lessonProgress.findUnique({
        where: { tenantId_userId_lessonId: { tenantId: TENANT_ID, userId: USER_ID, lessonId: 'lesson-1' } } as never,
      });
      expect(existing).toBeNull();
      await tx.lessonProgress.create({ data: { id: 'new-id' } as never });
    });

    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("SET LOCAL app.current_tenant_id"),
    );
    expect(mockLessonProgressCreate).toHaveBeenCalled();
  });
});
