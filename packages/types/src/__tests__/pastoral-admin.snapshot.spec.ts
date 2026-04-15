import { describe, it, expect } from 'vitest';
import {
  GroupCardSchema,
  ChurchOverviewResponseSchema,
  TimelineEntrySchema,
  GroupTimelineResponseSchema,
  LeaderViewResponseSchema,
  CreateOutreachIntentRequestSchema,
  UpdateOutreachIntentRequestSchema,
  OutreachIntentResponseSchema,
} from '../pastoral-admin';

describe('GroupCardSchema snapshot', () => {
  it('freezes a healthy card shape', () => {
    const result = GroupCardSchema.safeParse({
      groupId: '019756c0-0001-7000-8000-000000000001',
      groupName: 'Jovens Adultos',
      leaderId: '019756c0-0002-7000-8000-000000000001',
      leaderName: 'João Silva',
      status: 'healthy',
      statusPhrase: 'Conversa saudável esta semana',
      lastMeetingAt: '2026-04-12T20:00:00.000Z',
      memberCount: 8,
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "groupId": "019756c0-0001-7000-8000-000000000001",
          "groupName": "Jovens Adultos",
          "lastMeetingAt": "2026-04-12T20:00:00.000Z",
          "leaderId": "019756c0-0002-7000-8000-000000000001",
          "leaderName": "João Silva",
          "memberCount": 8,
          "status": "healthy",
          "statusPhrase": "Conversa saudável esta semana",
        },
        "success": true,
      }
    `);
  });

  it('rejects unknown status values', () => {
    const result = GroupCardSchema.safeParse({
      groupId: '019756c0-0001-7000-8000-000000000001',
      groupName: 'Jovens Adultos',
      leaderId: '019756c0-0002-7000-8000-000000000001',
      leaderName: 'João Silva',
      status: 'red',
      statusPhrase: 'invalid',
      lastMeetingAt: null,
      memberCount: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('ChurchOverviewResponseSchema snapshot', () => {
  it('parses an empty overview', () => {
    const result = ChurchOverviewResponseSchema.safeParse({
      data: [],
      meta: {
        lastCalculatedAt: '2026-04-15T06:00:00.000Z',
        groupCount: 0,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('TimelineEntrySchema discriminated union', () => {
  it('parses a meeting entry', () => {
    const result = TimelineEntrySchema.safeParse({
      entryId: '019756c0-0010-7000-8000-000000000001',
      occurredAt: '2026-04-12T20:00:00.000Z',
      type: 'meeting',
      presentCount: 6,
      totalCount: 8,
      reflectionText: 'Boa conversa sobre Romanos 8.',
    });
    expect(result.success).toBe(true);
  });

  it('parses a care entry', () => {
    const result = TimelineEntrySchema.safeParse({
      entryId: '019756c0-0011-7000-8000-000000000001',
      occurredAt: '2026-04-13T15:30:00.000Z',
      type: 'care',
      participantName: 'Pedro Almeida',
      signalStatus: 'care-attention',
      careNote: 'Conversamos sobre o trabalho dele.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown entry types', () => {
    const result = TimelineEntrySchema.safeParse({
      entryId: '019756c0-0012-7000-8000-000000000001',
      occurredAt: '2026-04-13T15:30:00.000Z',
      type: 'phone-call',
    });
    expect(result.success).toBe(false);
  });
});

describe('GroupTimelineResponseSchema snapshot', () => {
  it('parses a complete timeline response', () => {
    const result = GroupTimelineResponseSchema.safeParse({
      data: {
        group: {
          groupId: '019756c0-0001-7000-8000-000000000001',
          groupName: 'Jovens Adultos',
          leaderId: '019756c0-0002-7000-8000-000000000001',
          leaderName: 'João Silva',
          schedule: 'Quartas 20h',
          location: 'Sala 3',
          memberCount: 8,
          status: 'attention',
          statusPhrase: 'Vale acompanhar',
        },
        entries: [],
      },
      meta: {
        windowStart: '2026-04-01T00:00:00.000Z',
        windowEnd: '2026-04-15T00:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('LeaderViewResponseSchema snapshot', () => {
  it('parses a leader view with no current intent', () => {
    const result = LeaderViewResponseSchema.safeParse({
      data: {
        leader: {
          leaderId: '019756c0-0002-7000-8000-000000000001',
          firstName: 'João',
          fullName: 'João Silva',
          groupName: 'Jovens Adultos',
          tenure: '2 anos',
        },
        lastConversation: null,
        recentActivity: [],
        currentWeekIntent: null,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateOutreachIntentRequestSchema snapshot', () => {
  it('accepts a 280-char note', () => {
    const result = CreateOutreachIntentRequestSchema.safeParse({
      targetLeaderId: '019756c0-0002-7000-8000-000000000001',
      weekOf: '2026-04-13T00:00:00.000Z',
      note: 'x'.repeat(280),
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty note', () => {
    const result = CreateOutreachIntentRequestSchema.safeParse({
      targetLeaderId: '019756c0-0002-7000-8000-000000000001',
      weekOf: '2026-04-13T00:00:00.000Z',
      note: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a 281-char note', () => {
    const result = CreateOutreachIntentRequestSchema.safeParse({
      targetLeaderId: '019756c0-0002-7000-8000-000000000001',
      weekOf: '2026-04-13T00:00:00.000Z',
      note: 'x'.repeat(281),
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateOutreachIntentRequestSchema snapshot', () => {
  it('requires a non-empty note', () => {
    expect(
      UpdateOutreachIntentRequestSchema.safeParse({ note: '' }).success,
    ).toBe(false);
    expect(
      UpdateOutreachIntentRequestSchema.safeParse({
        note: 'Perguntar como ele está.',
      }).success,
    ).toBe(true);
  });
});

describe('OutreachIntentResponseSchema snapshot', () => {
  it('freezes the response shape', () => {
    const result = OutreachIntentResponseSchema.safeParse({
      data: {
        intentId: '019756c0-0020-7000-8000-000000000001',
        targetLeaderId: '019756c0-0002-7000-8000-000000000001',
        weekOf: '2026-04-13T00:00:00.000Z',
        note: 'Perguntar como ele está se sentindo conduzindo o grupo.',
        createdAt: '2026-04-15T17:30:00.000Z',
        updatedAt: '2026-04-15T17:30:00.000Z',
      },
    });
    expect({
      success: result.success,
      data: result.success ? result.data : null,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "data": {
            "createdAt": "2026-04-15T17:30:00.000Z",
            "intentId": "019756c0-0020-7000-8000-000000000001",
            "note": "Perguntar como ele está se sentindo conduzindo o grupo.",
            "targetLeaderId": "019756c0-0002-7000-8000-000000000001",
            "updatedAt": "2026-04-15T17:30:00.000Z",
            "weekOf": "2026-04-13T00:00:00.000Z",
          },
        },
        "success": true,
      }
    `);
  });
});
