import { describe, it, expect } from 'vitest';
import {
  MeetingStatusSchema,
  MeetingDetailSchema,
  OpenRoomResponseSchema,
  EndRoomResponseSchema,
  MeetingResponseSchema,
  CreateMeetingRequestSchema,
  UpdateMeetingRequestSchema,
  MeetingsListResponseSchema,
  MeetingsListQuerySchema,
  JoinMeetingResponseSchema,
} from '../meeting';

describe('MeetingStatusSchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = MeetingStatusSchema.safeParse('live');
    const cancelledCase = MeetingStatusSchema.safeParse('cancelled');
    const failureCase = MeetingStatusSchema.safeParse('unknown');
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      cancelledAccepted: cancelledCase.success,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "cancelledAccepted": true,
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

// --- Story 5.1 CRUD snapshots ------------------------------------------------

describe('MeetingResponseSchema snapshot (Story 5.1)', () => {
  it('freezes the full meeting response shape including nullable fields', () => {
    const successCase = MeetingResponseSchema.safeParse({
      id: '019756c0-0002-7000-8000-000000000001',
      tenantId: '019756c0-0002-7000-8000-000000000aaa',
      groupId: '019756c0-0002-7000-8000-000000000002',
      title: 'Encontro semanal',
      scheduledFor: '2026-04-20T19:30:00.000Z',
      durationMinutes: 60,
      status: 'scheduled',
      topic: null,
      providerRoomId: null,
      startedAt: null,
      endedAt: null,
      cancelledAt: null,
      createdBy: '019756c0-0002-7000-8000-000000000bbb',
      createdAt: '2026-04-19T12:00:00.000Z',
      updatedAt: '2026-04-19T12:00:00.000Z',
    });
    expect(successCase.success).toBe(true);
  });
});

describe('CreateMeetingRequestSchema snapshot (Story 5.1)', () => {
  it('accepts minimum required fields and rejects bad scheduledFor', () => {
    const ok = CreateMeetingRequestSchema.safeParse({
      groupId: '019756c0-0002-7000-8000-000000000002',
      scheduledFor: '2026-04-20T19:30:00.000Z',
    });
    const bad = CreateMeetingRequestSchema.safeParse({
      groupId: '019756c0-0002-7000-8000-000000000002',
      scheduledFor: 'not-a-date',
    });
    expect({ ok: ok.success, bad: !bad.success }).toEqual({
      ok: true,
      bad: true,
    });
  });

  it('rejects durationMinutes > 720', () => {
    const tooLong = CreateMeetingRequestSchema.safeParse({
      groupId: '019756c0-0002-7000-8000-000000000002',
      scheduledFor: '2026-04-20T19:30:00.000Z',
      durationMinutes: 999,
    });
    expect(tooLong.success).toBe(false);
  });
});

describe('UpdateMeetingRequestSchema snapshot (Story 5.1)', () => {
  it('requires at least one field', () => {
    const empty = UpdateMeetingRequestSchema.safeParse({});
    expect(empty.success).toBe(false);
  });

  it('accepts nullable title for clearing', () => {
    const ok = UpdateMeetingRequestSchema.safeParse({ title: null });
    expect(ok.success).toBe(true);
  });
});

describe('MeetingsListQuerySchema snapshot (Story 5.1)', () => {
  it('coerces string query params and defaults pagination', () => {
    const parsed = MeetingsListQuerySchema.parse({});
    expect(parsed).toEqual({ page: 1, perPage: 20 });
  });

  it('rejects perPage > 100', () => {
    const result = MeetingsListQuerySchema.safeParse({ perPage: 500 });
    expect(result.success).toBe(false);
  });
});

describe('MeetingsListResponseSchema snapshot (Story 5.1)', () => {
  it('freezes envelope with pagination meta', () => {
    const result = MeetingsListResponseSchema.safeParse({
      data: [],
      meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
    });
    expect(result.success).toBe(true);
  });
});

describe('JoinMeetingResponseSchema snapshot (Story 5.1)', () => {
  it('freezes join payload', () => {
    const result = JoinMeetingResponseSchema.safeParse({
      meetingId: '019756c0-0002-7000-8000-000000000001',
      roomName: 'tenant-a:meeting-1',
      joinToken: 'jwt.body.sig',
      livekitUrl: 'wss://livekit.example.com',
    });
    expect(result.success).toBe(true);
  });
});
