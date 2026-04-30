import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../../mocks/server';
import {
  useParticipantGroups,
  useParticipantGroup,
} from '../use-participant-groups';

const GROUP_ID = '019756c0-2000-7000-8000-000000000001';
const TOKEN = 'test-access-token';

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

interface CapturedRequest {
  url: string;
  authorization: string | null;
  contentType: string | null;
}

describe('participant-groups wire-up FE↔BE', () => {
  beforeEach(() => {
    sessionStorage.setItem('accessToken', TOKEN);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('list hook hits /api/v1/participant/groups with bearer token', async () => {
    const captured: CapturedRequest[] = [];
    server.use(
      http.get('*/api/v1/participant/groups', ({ request }) => {
        captured.push({
          url: request.url,
          authorization: request.headers.get('authorization'),
          contentType: request.headers.get('content-type'),
        });
        return HttpResponse.json({
          data: [],
          meta: { firstVisit: false },
        });
      }),
    );

    const { wrapper } = createHarness();
    const { result } = renderHook(() => useParticipantGroups(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(captured).toHaveLength(1);
    const [req] = captured;
    // The envelope client must prefix /api/v1 (default NEXT_PUBLIC_API_URL).
    expect(req.url).toMatch(/\/api\/v1\/participant\/groups$/);
    expect(req.authorization).toBe(`Bearer ${TOKEN}`);
    expect(req.contentType).toBe('application/json');

    expect(result.current.data?.data).toEqual([]);
    expect(result.current.data?.meta.firstVisit).toBe(false);
  });

  it('detail hook hits /api/v1/participant/groups/:id and parses backend payload', async () => {
    const captured: CapturedRequest[] = [];
    server.use(
      http.get('*/api/v1/participant/groups/:id', ({ request, params }) => {
        captured.push({
          url: request.url,
          authorization: request.headers.get('authorization'),
          contentType: request.headers.get('content-type'),
        });
        return HttpResponse.json({
          data: {
            id: String(params.id),
            name: 'Grupo Quarta 19h',
            description: null,
            leader: { firstName: 'Marcos', avatarUrl: null },
            recurrence: 'weekly',
            nextMeeting: {
              startsAt: '2026-04-29T22:00:00.000Z',
              dayOfWeek: 'wed',
              time: '19:00',
              location: null,
              meetingUrl: null,
            },
            format: null,
            duration: null,
            peers: [{ firstName: 'Carla' }, { firstName: 'Diana' }],
          },
        });
      }),
    );

    const { wrapper } = createHarness();
    const { result } = renderHook(() => useParticipantGroup(GROUP_ID), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(captured).toHaveLength(1);
    expect(captured[0].url).toMatch(
      new RegExp(`/api/v1/participant/groups/${GROUP_ID}$`),
    );
    expect(captured[0].authorization).toBe(`Bearer ${TOKEN}`);

    const payload = result.current.data?.data;
    expect(payload?.id).toBe(GROUP_ID);
    expect(payload?.name).toBe('Grupo Quarta 19h');
    expect(payload?.leader.firstName).toBe('Marcos');
    expect(payload?.peers).toEqual([
      { firstName: 'Carla' },
      { firstName: 'Diana' },
    ]);
  });

  it('list hook surfaces backend error envelope without crashing', async () => {
    server.use(
      http.get('*/api/v1/participant/groups', () =>
        HttpResponse.json(
          {
            statusCode: 500,
            error: 'InternalServerError',
            message: 'boom',
          },
          { status: 500 },
        ),
      ),
    );

    const { wrapper } = createHarness();
    const { result } = renderHook(() => useParticipantGroups(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
