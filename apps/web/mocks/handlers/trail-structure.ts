import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TRAIL_ID = '019756a1-0000-7000-8000-000000000001';
const MODULE_A_ID = '019756a1-0000-7000-8000-000000000010';
const MODULE_B_ID = '019756a1-0000-7000-8000-000000000011';
const LESSON_1_ID = '019756a1-0000-7000-8000-000000000020';
const LESSON_2_ID = '019756a1-0000-7000-8000-000000000021';
const LESSON_3_ID = '019756a1-0000-7000-8000-000000000022';
const TENANT_ID = '019756a1-0000-7000-8000-000000000099';

export const mockTrail = {
  id: TRAIL_ID,
  tenantId: TENANT_ID,
  name: 'Fundamentos da Fé',
  description: 'Uma trilha de discipulado para novos crentes.',
  status: 'published' as const,
  accessMode: 'free' as const,
  version: 1,
  publishedAt: '2026-01-01T00:00:00.000Z',
  publishedBy: TENANT_ID,
  catalogVisible: true,
  createdBy: TENANT_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

export const mockModules = [
  {
    id: MODULE_A_ID,
    tenantId: TENANT_ID,
    trailId: TRAIL_ID,
    name: 'Módulo 1 — Oração',
    order: 0,
    lessonAccessMode: 'free' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: MODULE_B_ID,
    tenantId: TENANT_ID,
    trailId: TRAIL_ID,
    name: 'Módulo 2 — Palavra',
    order: 1,
    lessonAccessMode: 'sequential' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  },
];

export const mockLessonsModuleA = [
  {
    id: LESSON_1_ID,
    tenantId: TENANT_ID,
    moduleId: MODULE_A_ID,
    name: 'Introdução à Oração',
    contentType: 'video' as const,
    contentUrl: 'https://example.com/video1.mp4',
    contentBody: null,
    tags: [],
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: null,
    uploadedAt: null,
    order: 0,
    estimatedDurationMinutes: 15,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: LESSON_2_ID,
    tenantId: TENANT_ID,
    moduleId: MODULE_A_ID,
    name: 'Tipos de Oração',
    contentType: 'rich_text' as const,
    contentUrl: null,
    contentBody: '<p>Conteúdo sobre oração</p>',
    tags: [],
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: null,
    uploadedAt: null,
    order: 1,
    estimatedDurationMinutes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  },
];

export const mockLessonsModuleB = [
  {
    id: LESSON_3_ID,
    tenantId: TENANT_ID,
    moduleId: MODULE_B_ID,
    name: 'Lendo a Bíblia',
    contentType: 'pdf_doc' as const,
    contentUrl: 'https://example.com/biblia.pdf',
    contentBody: null,
    tags: [],
    originalName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: null,
    uploadedAt: null,
    order: 0,
    estimatedDurationMinutes: 30,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
  },
];

// Note: apiClient.get extracts .data from the JSON response before parsing with the schema.
// TrailProgressDetailResponseSchema = { data: TrailProgressDetailSchema }
// So schema.parse receives json.data, which must be { data: TrailProgressDetail }.
// Therefore the HTTP response must be: { data: { data: TrailProgressDetail } }

export const mockProgressEmpty = {
  data: {
    data: {
      trailId: TRAIL_ID,
      progressPercent: 0,
      completedModules: 0,
      totalModules: 2,
      modules: [],
    },
  },
};

export const mockProgressWithInProgress = {
  data: {
    data: {
      trailId: TRAIL_ID,
      progressPercent: 33,
      completedModules: 0,
      totalModules: 2,
      modules: [
        {
          moduleId: MODULE_A_ID,
          progressPercent: 50,
          completedLessons: 0,
          totalLessons: 2,
          lessons: [
            {
              lessonId: LESSON_1_ID,
              status: 'in_progress',
              progressPercent: 50,
              lastAccessedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    },
  },
};

// Same double-wrap pattern as progress: apiClient.get extracts .data, then schema parses.
// ResumeProgressResponseSchema = { data: { lessonId, moduleId, lastAccessedAt } }

export const mockResumeNull = {
  data: {
    data: {
      lessonId: null,
      moduleId: null,
      lastAccessedAt: null,
    },
  },
};

export const mockResumeLesson1 = {
  data: {
    data: {
      lessonId: LESSON_1_ID,
      moduleId: MODULE_A_ID,
      lastAccessedAt: '2026-01-01T00:00:00.000Z',
    },
  },
};

export const {
  TRAIL_ID: MOCK_TRAIL_ID,
  MODULE_A_ID: MOCK_MODULE_A_ID,
  MODULE_B_ID: MOCK_MODULE_B_ID,
  LESSON_1_ID: MOCK_LESSON_1_ID,
  LESSON_2_ID: MOCK_LESSON_2_ID,
  LESSON_3_ID: MOCK_LESSON_3_ID,
} = {
  TRAIL_ID,
  MODULE_A_ID,
  MODULE_B_ID,
  LESSON_1_ID,
  LESSON_2_ID,
  LESSON_3_ID,
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const trailStructureHandlers = [
  http.get('*/api/v1/trails/:trailId', ({ params }) => {
    if (params.trailId === TRAIL_ID) {
      return HttpResponse.json({ data: mockTrail });
    }
    return HttpResponse.json({ statusCode: 404, error: 'Not Found', message: 'Trail not found' }, { status: 404 });
  }),

  http.get('*/api/v1/trails/:trailId/modules', ({ params }) => {
    if (params.trailId === TRAIL_ID) {
      return HttpResponse.json({ data: mockModules, meta: { total: 2 } });
    }
    return HttpResponse.json({ data: [], meta: { total: 0 } });
  }),

  http.get('*/api/v1/trails/:trailId/modules/:moduleId/lessons', ({ params }) => {
    if (params.moduleId === MODULE_A_ID) {
      return HttpResponse.json({ data: mockLessonsModuleA, meta: { total: 2 } });
    }
    if (params.moduleId === MODULE_B_ID) {
      return HttpResponse.json({ data: mockLessonsModuleB, meta: { total: 1 } });
    }
    return HttpResponse.json({ data: [], meta: { total: 0 } });
  }),

  http.get('*/api/v1/progress/trails/:trailId', () =>
    HttpResponse.json(mockProgressEmpty),
  ),

  http.get('*/api/v1/progress/trails/:trailId/resume', () =>
    HttpResponse.json(mockResumeNull),
  ),
];
