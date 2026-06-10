/**
 * N+1 Prevention Test
 * Validates that findTrailWithModulesAndLessons uses a single Prisma query
 * (via include) instead of N separate queries for modules/lessons.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentRepository } from './content.repository';
import { PrismaService } from '../prisma/prisma.service';
import { requestContext } from '../common/context/request-context';

const TENANT_ID = '019756c0-0001-7000-8000-000000000002';
const TRAIL_ID = '019756c0-0001-7000-8000-000000000010';

const trailWithModulesAndLessons = {
  id: TRAIL_ID,
  tenantId: TENANT_ID,
  name: 'Trilha de Discipulado',
  description: null,
  status: 'published' as const,
  createdBy: '019756c0-0001-7000-8000-000000000003',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  modules: [
    {
      id: '019756c0-0001-7000-8000-000000000020',
      tenantId: TENANT_ID,
      trailId: TRAIL_ID,
      name: 'Módulo 1',
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      lessons: [
        {
          id: '019756c0-0001-7000-8000-000000000030',
          tenantId: TENANT_ID,
          moduleId: '019756c0-0001-7000-8000-000000000020',
          name: 'Aula 1',
          contentType: 'video' as const,
          contentUrl: null,
          contentBody: null,
          tags: [],
          originalName: null,
          mimeType: null,
          sizeBytes: null,
          uploadedBy: null,
          uploadedAt: null,
          order: 0,
          estimatedDurationMinutes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: '019756c0-0001-7000-8000-000000000031',
          tenantId: TENANT_ID,
          moduleId: '019756c0-0001-7000-8000-000000000020',
          name: 'Aula 2',
          contentType: 'pdf_doc' as const,
          contentUrl: 'content/t/trail/lesson/doc.pdf',
          contentBody: null,
          tags: ['bible', 'study'],
          originalName: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: BigInt(204800),
          uploadedBy: '019756c0-0001-7000-8000-000000000003',
          uploadedAt: new Date(),
          order: 1,
          estimatedDurationMinutes: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
    },
  ],
};

/** Run a function inside the requestContext (AsyncLocalStorage) with a mocked tenant */
function withTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return requestContext.run({ tenantId, userId: undefined }, fn);
}

describe('ContentRepository — N+1 prevention', () => {
  let repo: ContentRepository;
  let mockTrailFindFirst: ReturnType<typeof vi.fn>;
  let prismaCallCount: number;

  beforeEach(() => {
    prismaCallCount = 0;

    mockTrailFindFirst = vi.fn().mockImplementation(() => {
      prismaCallCount++;
      return Promise.resolve(trailWithModulesAndLessons);
    });

    const mockTx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      trail: { findFirst: mockTrailFindFirst },
      module: { findMany: vi.fn().mockResolvedValue([]) },
      lesson: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const mockClientWithTx = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => unknown) => {
        return fn(mockTx);
      }),
    };

    const mockPrisma = {
      client: mockClientWithTx,
    } as unknown as PrismaService;

    repo = new ContentRepository(mockPrisma);
  });

  it('loads trail with modules and lessons in a SINGLE query call', async () => {
    const result = await withTenantContext(TENANT_ID, () =>
      repo.findTrailWithModulesAndLessons(TRAIL_ID),
    );

    // Only ONE Prisma trail.findFirst call — modules+lessons loaded via include
    expect(prismaCallCount).toBe(1);
    expect(result).not.toBeNull();
    expect(result!.modules).toHaveLength(1);
    expect(result!.modules[0].lessons).toHaveLength(2);
  });

  it('passes correct include clause with nested modules+lessons', async () => {
    await withTenantContext(TENANT_ID, () =>
      repo.findTrailWithModulesAndLessons(TRAIL_ID),
    );

    const callArgs = mockTrailFindFirst.mock.calls[0][0];

    // Should use Prisma `include` (not select) for eager loading
    expect(callArgs).toMatchObject({
      where: { id: TRAIL_ID, deletedAt: null },
      include: {
        modules: expect.objectContaining({
          include: {
            lessons: expect.objectContaining({
              where: { deletedAt: null },
            }),
          },
        }),
      },
    });
  });

  it('orders modules and lessons by `order` ASC', async () => {
    await withTenantContext(TENANT_ID, () =>
      repo.findTrailWithModulesAndLessons(TRAIL_ID),
    );

    const callArgs = mockTrailFindFirst.mock.calls[0][0];
    expect(callArgs.include.modules.orderBy).toEqual({ order: 'asc' });
    expect(callArgs.include.modules.include.lessons.orderBy).toEqual({ order: 'asc' });
  });
});
