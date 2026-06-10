import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ContentService } from './content.service';
import type { ContentRepository } from './content.repository';

// ---------------------------------------------------------------------------
// Mock request context
// ---------------------------------------------------------------------------
vi.mock('../common/context/request-context', () => ({
  getRequestContext: () => ({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

// ---------------------------------------------------------------------------
// Factory for mock repository
// ---------------------------------------------------------------------------
const TRAIL_ID = '019756c0-0001-7000-8000-000000000010';
const TENANT_ID = '019756c0-0001-7000-8000-000000000002';
const USER_ID = '019756c0-0001-7000-8000-000000000003';
const MODULE_ID = '019756c0-0001-7000-8000-000000000020';
const LESSON_ID = '019756c0-0001-7000-8000-000000000030';

function makeTrail(overrides = {}) {
  return {
    id: TRAIL_ID,
    tenantId: TENANT_ID,
    name: 'Trilha de Discipulado',
    description: null,
    status: 'draft' as const,
    accessMode: 'free' as const,
    version: null,
    publishedAt: null,
    publishedBy: null,
    catalogVisible: false,
    createdBy: USER_ID,
    createdAt: new Date('2026-06-10T12:00:00.000Z'),
    updatedAt: new Date('2026-06-10T12:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function makeModule(overrides = {}) {
  return {
    id: MODULE_ID,
    tenantId: TENANT_ID,
    trailId: TRAIL_ID,
    name: 'Módulo 1',
    order: 0,
    lessonAccessMode: 'free' as const,
    createdAt: new Date('2026-06-10T12:00:00.000Z'),
    updatedAt: new Date('2026-06-10T12:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function makeLesson(overrides = {}) {
  return {
    id: LESSON_ID,
    tenantId: TENANT_ID,
    moduleId: MODULE_ID,
    name: 'Aula 1',
    contentType: 'video' as const,
    contentUrl: null,
    contentBody: null,
    tags: [] as string[],
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: null,
    uploadedAt: null,
    order: 0,
    estimatedDurationMinutes: null,
    createdAt: new Date('2026-06-10T12:00:00.000Z'),
    updatedAt: new Date('2026-06-10T12:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function makeMockRepo() {
  return {
    createTrail: vi.fn(),
    countTrailsByTenant: vi.fn(),
    listTrails: vi.fn(),
    findTrailById: vi.fn(),
    updateTrail: vi.fn(),
    softDeleteTrail: vi.fn(),
    createModule: vi.fn(),
    countModulesByTrail: vi.fn(),
    listModules: vi.fn(),
    findModuleById: vi.fn(),
    updateModule: vi.fn(),
    softDeleteModule: vi.fn(),
    reorderModules: vi.fn(),
    createLesson: vi.fn(),
    listLessons: vi.fn(),
    findLessonById: vi.fn(),
    updateLesson: vi.fn(),
    softDeleteLesson: vi.fn(),
    reorderLessons: vi.fn(),
    findLessonByIdOnly: vi.fn(),
    findTrailWithModulesAndLessons: vi.fn(),
  } as unknown as ContentRepository;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ContentService — Trail CRUD', () => {
  let service: ContentService;
  let repo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new ContentService(repo as ContentRepository);
  });

  it('createTrail returns response with default draft status', async () => {
    vi.mocked(repo.createTrail).mockResolvedValue(makeTrail());
    const result = await service.createTrail({ name: 'Trilha de Discipulado' });
    expect(result.status).toBe('draft');
    expect(result.name).toBe('Trilha de Discipulado');
  });

  it('findTrailById throws 404 when not found', async () => {
    vi.mocked(repo.findTrailById).mockResolvedValue(null);
    await expect(service.findTrailById('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('listTrails returns paginated response', async () => {
    vi.mocked(repo.listTrails).mockResolvedValue([makeTrail()]);
    vi.mocked(repo.countTrailsByTenant).mockResolvedValue(1);
    const result = await service.listTrails({ page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.page).toBe(1);
  });

  it('updateTrail throws 404 when trail not found', async () => {
    vi.mocked(repo.updateTrail).mockResolvedValue(null);
    await expect(service.updateTrail('nonexistent', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deleteTrail throws 404 when trail not found', async () => {
    vi.mocked(repo.softDeleteTrail).mockResolvedValue(null);
    await expect(service.deleteTrail('nonexistent')).rejects.toThrow(NotFoundException);
  });
});

describe('ContentService — Module CRUD', () => {
  let service: ContentService;
  let repo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new ContentService(repo as ContentRepository);
  });

  it('createModule throws 404 when trail not found', async () => {
    vi.mocked(repo.countModulesByTrail).mockResolvedValue(0);
    vi.mocked(repo.createModule).mockRejectedValue(new Error('TRAIL_NOT_FOUND'));
    await expect(service.createModule(TRAIL_ID, { name: 'M1' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updateModule throws 404 when module not found', async () => {
    vi.mocked(repo.updateModule).mockResolvedValue(null);
    await expect(service.updateModule(TRAIL_ID, MODULE_ID, { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deleteModule throws 404 when module not found', async () => {
    vi.mocked(repo.softDeleteModule).mockResolvedValue(null);
    await expect(service.deleteModule(TRAIL_ID, MODULE_ID)).rejects.toThrow(NotFoundException);
  });
});

describe('ContentService — Reorder validation', () => {
  let service: ContentService;
  let repo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new ContentService(repo as ContentRepository);
  });

  it('reorderModules throws 422 on duplicate IDs', async () => {
    vi.mocked(repo.findTrailById).mockResolvedValue(makeTrail());
    vi.mocked(repo.reorderModules).mockRejectedValue(new Error('REORDER_DUPLICATE_IDS'));
    await expect(
      service.reorderModules(TRAIL_ID, { moduleIds: [MODULE_ID, MODULE_ID] }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('reorderModules throws 422 on wrong parent', async () => {
    vi.mocked(repo.findTrailById).mockResolvedValue(makeTrail());
    vi.mocked(repo.reorderModules).mockRejectedValue(new Error('REORDER_WRONG_PARENT'));
    await expect(
      service.reorderModules(TRAIL_ID, { moduleIds: ['foreign-id'] }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('reorderModules throws 422 on count mismatch', async () => {
    vi.mocked(repo.findTrailById).mockResolvedValue(makeTrail());
    vi.mocked(repo.reorderModules).mockRejectedValue(new Error('REORDER_COUNT_MISMATCH'));
    await expect(
      service.reorderModules(TRAIL_ID, { moduleIds: [MODULE_ID] }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('reorderLessons throws 422 on duplicate IDs', async () => {
    vi.mocked(repo.findModuleById).mockResolvedValue(makeModule());
    vi.mocked(repo.reorderLessons).mockRejectedValue(new Error('REORDER_DUPLICATE_IDS'));
    await expect(
      service.reorderLessons(TRAIL_ID, MODULE_ID, {
        lessonIds: [LESSON_ID, LESSON_ID],
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });
});

describe('ContentService — Lesson CRUD', () => {
  let service: ContentService;
  let repo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new ContentService(repo as ContentRepository);
  });

  it('createLesson throws 404 when module not found', async () => {
    vi.mocked(repo.createLesson).mockRejectedValue(new Error('MODULE_NOT_FOUND'));
    await expect(
      service.createLesson(TRAIL_ID, MODULE_ID, {
        name: 'Aula 1',
        contentType: 'video',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('updateLesson throws 404 when lesson not found', async () => {
    vi.mocked(repo.updateLesson).mockResolvedValue(null);
    await expect(
      service.updateLesson(TRAIL_ID, MODULE_ID, LESSON_ID, { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('deleteLesson throws 404 when lesson not found', async () => {
    vi.mocked(repo.softDeleteLesson).mockResolvedValue(null);
    await expect(service.deleteLesson(TRAIL_ID, MODULE_ID, LESSON_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('createLesson returns response with contentUrl null by default', async () => {
    vi.mocked(repo.createLesson).mockResolvedValue(makeLesson());
    const result = await service.createLesson(TRAIL_ID, MODULE_ID, {
      name: 'Aula 1',
      contentType: 'video',
    });
    expect(result.contentUrl).toBeNull();
    expect(result.contentType).toBe('video');
  });
});

describe('ContentService — soft-delete cascade', () => {
  let service: ContentService;
  let repo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new ContentService(repo as ContentRepository);
  });

  it('deleteTrail calls softDeleteTrail which cascades internally', async () => {
    vi.mocked(repo.softDeleteTrail).mockResolvedValue(makeTrail({ deletedAt: new Date() }));
    await service.deleteTrail(TRAIL_ID);
    expect(repo.softDeleteTrail).toHaveBeenCalledWith(TRAIL_ID);
  });
});
