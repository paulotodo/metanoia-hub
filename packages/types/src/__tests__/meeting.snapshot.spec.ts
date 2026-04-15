import { describe, it, expect } from 'vitest';
import {
  MeetingStatusSchema,
  MeetingDetailSchema,
  OpenRoomResponseSchema,
  EndRoomResponseSchema,
} from '../meeting';

describe('MeetingStatusSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = MeetingStatusSchema.safeParse('live');
    const failureCase = MeetingStatusSchema.safeParse('cancelled');
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": "live",
        "failure": true,
        "success": true,
      }
    `);
  });
});

describe('MeetingDetailSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = MeetingDetailSchema.safeParse({
      meetingId: '019756c0-0002-7000-8000-000000000001',
      groupId: '019756c0-0002-7000-8000-000000000002',
      groupName: 'Celula de Quinta',
      scheduledFor: '2026-04-16T22:30:00.000Z',
      status: 'scheduled',
      topic: 'Mateus 6 — Oracao',
      confirmed: [
        {
          participantId: '019756c0-0002-7000-8000-000000000010',
          name: 'Pedro',
          response: 'yes',
        },
        {
          participantId: '019756c0-0002-7000-8000-000000000011',
          name: 'Ana',
          response: 'pending',
        },
      ],
      milestones: [
        {
          id: '019756c0-0002-7000-8000-000000000020',
          text: 'Retiro de homens dia 20',
        },
      ],
    });
    const failureCase = MeetingDetailSchema.safeParse({
      meetingId: 'not-a-uuid',
      groupId: '019756c0-0002-7000-8000-000000000002',
      groupName: 'Celula',
      scheduledFor: 'not-a-date',
      status: 'unknown',
      topic: null,
      confirmed: [],
      milestones: [],
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "confirmed": [
            {
              "name": "Pedro",
              "participantId": "019756c0-0002-7000-8000-000000000010",
              "response": "yes",
            },
            {
              "name": "Ana",
              "participantId": "019756c0-0002-7000-8000-000000000011",
              "response": "pending",
            },
          ],
          "groupId": "019756c0-0002-7000-8000-000000000002",
          "groupName": "Celula de Quinta",
          "meetingId": "019756c0-0002-7000-8000-000000000001",
          "milestones": [
            {
              "id": "019756c0-0002-7000-8000-000000000020",
              "text": "Retiro de homens dia 20",
            },
          ],
          "scheduledFor": "2026-04-16T22:30:00.000Z",
          "status": "scheduled",
          "topic": "Mateus 6 — Oracao",
        },
        "failure": true,
        "success": true,
      }
    `);
  });

  it('accepts null topic and empty arrays', () => {
    const result = MeetingDetailSchema.safeParse({
      meetingId: '019756c0-0002-7000-8000-000000000001',
      groupId: '019756c0-0002-7000-8000-000000000002',
      groupName: 'Celula simples',
      scheduledFor: '2026-04-16T22:30:00.000Z',
      status: 'scheduled',
      topic: null,
      confirmed: [],
      milestones: [],
    });
    expect(result.success).toBe(true);
  });
});

describe('OpenRoomResponseSchema snapshot', () => {
  it('freezes success shape', () => {
    const successCase = OpenRoomResponseSchema.safeParse({
      roomId: '019756c0-0002-7000-8000-000000000030',
      roomName: 'tenant-a:meeting-1',
      joinToken: 'header.payload.signature',
      livekitUrl: 'wss://livekit.example.com',
      startedAt: '2026-04-16T22:30:05.000Z',
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "joinToken": "header.payload.signature",
          "livekitUrl": "wss://livekit.example.com",
          "roomId": "019756c0-0002-7000-8000-000000000030",
          "roomName": "tenant-a:meeting-1",
          "startedAt": "2026-04-16T22:30:05.000Z",
        },
        "success": true,
      }
    `);
  });
});

describe('EndRoomResponseSchema snapshot', () => {
  it('freezes success shape', () => {
    const successCase = EndRoomResponseSchema.safeParse({
      meetingId: '019756c0-0002-7000-8000-000000000001',
      endedAt: '2026-04-16T23:30:00.000Z',
    });
    expect(successCase.success).toBe(true);
  });
});
