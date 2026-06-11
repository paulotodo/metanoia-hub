import { http, HttpResponse } from 'msw';
import type { MyTrailsResponse } from '@metanoia/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MOCK_MY_TRAIL_ID_1 = '018e6b1c-0000-7000-8000-000000000101';
export const MOCK_MY_TRAIL_ID_2 = '018e6b1c-0000-7000-8000-000000000102';
export const MOCK_MY_TRAIL_ID_3 = '018e6b1c-0000-7000-8000-000000000103';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockMyTrails: MyTrailsResponse = {
  data: [
    {
      id: MOCK_MY_TRAIL_ID_1,
      name: 'Discipulado Básico',
      description: 'Fundamentos da fé cristã para novos crentes.',
      moduleCount: 3,
      lessonCount: 12,
      progressPercent: 50,
      status: 'in_progress',
      lastActivity: '2026-06-10T14:30:00.000Z',
    },
    {
      id: MOCK_MY_TRAIL_ID_2,
      name: 'Oração e Intercessão',
      description: null,
      moduleCount: 2,
      lessonCount: 8,
      progressPercent: 0,
      status: 'not_started',
      lastActivity: null,
    },
    {
      id: MOCK_MY_TRAIL_ID_3,
      name: 'Vida em Comunidade',
      description: 'Como viver em comunidade cristã.',
      moduleCount: 4,
      lessonCount: 16,
      progressPercent: 100,
      status: 'completed',
      lastActivity: '2026-05-20T10:00:00.000Z',
    },
  ],
  meta: {
    nextCursor: null,
    total: 3,
  },
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const myTrailsHandlers = [
  http.get('*/api/v1/my-trails', ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');

    // Simulate empty page when cursor is provided (end of data)
    if (cursor) {
      return HttpResponse.json({ data: [], meta: { nextCursor: null, total: 3 } } satisfies MyTrailsResponse);
    }

    return HttpResponse.json(mockMyTrails);
  }),
];
