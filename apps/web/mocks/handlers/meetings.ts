import { http, HttpResponse } from 'msw';
import {
  mockMeetingAgenda,
  mockMeetingAgendaEmpty,
  mockMeetingAgendaLive,
} from '../../__mocks__/meetings';

function resolveMeeting(meetingId: string) {
  if (meetingId === mockMeetingAgendaEmpty.meetingId) {
    return mockMeetingAgendaEmpty;
  }
  if (meetingId === mockMeetingAgendaLive.meetingId) {
    return mockMeetingAgendaLive;
  }
  return { ...mockMeetingAgenda, meetingId };
}

export const meetingsHandlers = [
  http.get('*/api/v1/meetings/:meetingId', ({ params }) => {
    const meetingId = String(params.meetingId);
    return HttpResponse.json({ data: resolveMeeting(meetingId) });
  }),

  http.post('*/api/v1/meetings/:meetingId/room', ({ params }) => {
    const meetingId = String(params.meetingId);
    return HttpResponse.json({
      data: {
        roomId: `RM_${meetingId.slice(0, 8)}`,
        roomName: `tenant-mock:${meetingId}`,
        joinToken: 'mock-livekit-join-token',
        livekitUrl: 'ws://localhost:7880',
        startedAt: new Date().toISOString(),
      },
    });
  }),

  http.post('*/api/v1/meetings/:meetingId/room/end', ({ params }) => {
    const meetingId = String(params.meetingId);
    return HttpResponse.json({
      data: {
        meetingId,
        endedAt: new Date().toISOString(),
      },
    });
  }),

  http.post('*/api/v1/meetings/:meetingId/reflections', async ({ request }) => {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === 'string' ? body.text : '';

    if (text.length === 0 || text.length > 280) {
      return HttpResponse.json(
        {
          statusCode: 400,
          error: 'ValidationError',
          message: 'text must be between 1 and 280 characters',
        },
        { status: 400 },
      );
    }

    return HttpResponse.json(
      {
        data: {
          reflectionId: '019756c0-0002-7000-8000-000000000301',
          recordedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  }),
];
