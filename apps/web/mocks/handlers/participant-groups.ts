import { http, HttpResponse } from 'msw';
import type {
  ParticipantGroupDetailResponse,
  ParticipantGroupsListResponse,
} from '@metanoia/types';

const MOCK_GROUP_ID = '019756c0-2000-7000-8000-000000000001';
const MOCK_SECOND_GROUP_ID = '019756c0-2000-7000-8000-000000000002';

const buildList = (firstVisit: boolean): ParticipantGroupsListResponse => ({
  data: [
    {
      id: MOCK_GROUP_ID,
      name: 'Fundamentos da Fé',
      leader: {
        firstName: 'Marcos',
        avatarUrl: null,
      },
      nextMeeting: {
        startsAt: '2026-04-21T22:00:00.000Z',
        dayOfWeek: 'tue',
        time: '19:00',
        location: 'Sala 3, Igreja Central',
      },
    },
    {
      id: MOCK_SECOND_GROUP_ID,
      name: 'Caminhada em Cristo',
      leader: {
        firstName: 'Beatriz',
        avatarUrl: null,
      },
      nextMeeting: null,
    },
  ],
  meta: {
    firstVisit,
  },
});

const emptyList: ParticipantGroupsListResponse = {
  data: [],
  meta: { firstVisit: true },
};

const mockParticipantGroupDetail: ParticipantGroupDetailResponse = {
  data: {
    id: MOCK_GROUP_ID,
    name: 'Fundamentos da Fé',
    description:
      'Um espaço seguro pra gente conversar sobre o caminho da fé, sem pressa e sem julgamento.',
    leader: {
      firstName: 'Marcos',
      avatarUrl: null,
    },
    recurrence: 'weekly',
    nextMeeting: {
      startsAt: '2026-04-21T22:00:00.000Z',
      dayOfWeek: 'tue',
      time: '19:00',
      location: 'Sala 3, Igreja Central',
    },
    format: 'in_person',
    duration: '1h30',
  },
};

const mockParticipantGroupDetailMinimal: ParticipantGroupDetailResponse = {
  data: {
    id: MOCK_SECOND_GROUP_ID,
    name: 'Caminhada em Cristo',
    description: null,
    leader: {
      firstName: 'Beatriz',
      avatarUrl: null,
    },
    recurrence: 'weekly',
    nextMeeting: null,
    format: null,
    duration: null,
  },
};

export const participantGroupsHandlers = [
  http.get('*/api/v1/participant/groups', ({ request }) => {
    const url = new URL(request.url);
    if (request.headers.get('x-mock-empty') === '1') {
      return HttpResponse.json(emptyList);
    }
    const firstVisit = url.searchParams.get('firstVisit') !== 'false';
    return HttpResponse.json(buildList(firstVisit));
  }),

  http.get('*/api/v1/participant/groups/:id', ({ params }) => {
    const id = String(params.id ?? '');
    if (id === MOCK_GROUP_ID) {
      return HttpResponse.json(mockParticipantGroupDetail);
    }
    if (id === MOCK_SECOND_GROUP_ID) {
      return HttpResponse.json(mockParticipantGroupDetailMinimal);
    }
    return HttpResponse.json(
      {
        statusCode: 404,
        error: 'Not Found',
        message: 'Group not found or not accessible',
      },
      { status: 404 },
    );
  }),
];
