import { http, HttpResponse } from 'msw';
import type {
  ParticipantGroupDetailResponse,
  ParticipantGroupsListResponse,
} from '@metanoia/types';

const MOCK_GROUP_ID = '019756c0-2000-7000-8000-000000000001';
const MOCK_SECOND_GROUP_ID = '019756c0-2000-7000-8000-000000000002';

const mockParticipantGroupsList: ParticipantGroupsListResponse = {
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
        meetingUrl: null,
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
    firstVisit: true,
  },
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
      meetingUrl: 'https://meet.metanoia.example/fundamentos',
    },
    peers: [
      { firstName: 'Ana' },
      { firstName: 'Rafael' },
      { firstName: 'Clara' },
    ],
  },
};

export const participantGroupsHandlers = [
  http.get('*/api/v1/participant/groups', () =>
    HttpResponse.json(mockParticipantGroupsList),
  ),

  http.get('*/api/v1/participant/groups/:id', ({ params }) => {
    const id = String(params.id ?? '');
    if (id !== MOCK_GROUP_ID) {
      return HttpResponse.json(
        {
          statusCode: 404,
          error: 'Not Found',
          message: 'Group not found or not accessible',
        },
        { status: 404 },
      );
    }
    return HttpResponse.json(mockParticipantGroupDetail);
  }),
];
