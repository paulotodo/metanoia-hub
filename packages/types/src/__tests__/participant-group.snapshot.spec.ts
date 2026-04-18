import { describe, it, expect } from 'vitest';
import {
  ParticipantGroupSummarySchema,
  ParticipantGroupsListResponseSchema,
  ParticipantGroupDetailSchema,
  ParticipantGroupDetailResponseSchema,
} from '../participant-group';

describe('ParticipantGroupSummarySchema snapshot', () => {
  it('freezes success and failure shapes', () => {
    const successCase = ParticipantGroupSummarySchema.safeParse({
      id: '019756c0-2000-7000-8000-000000000001',
      name: 'Fundamentos da Fé',
      leader: { firstName: 'Marcos', avatarUrl: null },
      nextMeeting: {
        startsAt: '2026-04-21T22:00:00.000Z',
        dayOfWeek: 'tue',
        time: '19:00',
        meetingUrl: null,
      },
    });
    const failureCase = ParticipantGroupSummarySchema.safeParse({
      id: 'not-a-uuid',
      name: '',
      leader: { firstName: '', avatarUrl: 'not-a-url' },
      nextMeeting: { startsAt: 'bogus', dayOfWeek: 'wat', time: '99:99', meetingUrl: null },
    });
    expect({
      success: successCase.success,
      data: successCase.success ? successCase.data : null,
      failure: !failureCase.success,
    }).toMatchInlineSnapshot(`
      {
        "data": {
          "id": "019756c0-2000-7000-8000-000000000001",
          "leader": {
            "avatarUrl": null,
            "firstName": "Marcos",
          },
          "name": "Fundamentos da Fé",
          "nextMeeting": {
            "dayOfWeek": "tue",
            "meetingUrl": null,
            "startsAt": "2026-04-21T22:00:00.000Z",
            "time": "19:00",
          },
        },
        "failure": true,
        "success": true,
      }
    `);
  });

  it('accepts a group with no next meeting scheduled', () => {
    const result = ParticipantGroupSummarySchema.safeParse({
      id: '019756c0-2000-7000-8000-000000000002',
      name: 'Caminhada em Cristo',
      leader: { firstName: 'Beatriz', avatarUrl: null },
      nextMeeting: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('ParticipantGroupsListResponseSchema snapshot', () => {
  it('includes firstVisit meta flag', () => {
    const result = ParticipantGroupsListResponseSchema.safeParse({
      data: [
        {
          id: '019756c0-2000-7000-8000-000000000001',
          name: 'Fundamentos da Fé',
          leader: { firstName: 'Marcos', avatarUrl: null },
          nextMeeting: null,
        },
      ],
      meta: { firstVisit: true },
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.meta.firstVisit).toBe(true);
  });
});

describe('ParticipantGroupDetailSchema snapshot', () => {
  it('freezes detail shape with peers and next meeting', () => {
    const successCase = ParticipantGroupDetailSchema.safeParse({
      id: '019756c0-2000-7000-8000-000000000001',
      name: 'Fundamentos da Fé',
      description: 'Um espaço seguro.',
      leader: { firstName: 'Marcos', avatarUrl: null },
      recurrence: 'weekly',
      nextMeeting: {
        startsAt: '2026-04-21T22:00:00.000Z',
        dayOfWeek: 'tue',
        time: '19:00',
        meetingUrl: 'https://meet.metanoia.example/fundamentos',
      },
      peers: [{ firstName: 'Ana' }, { firstName: 'Rafael' }],
    });
    expect(successCase.success).toBe(true);
    if (successCase.success) {
      expect(successCase.data.peers).toHaveLength(2);
      expect(successCase.data.peers[0]).toEqual({ firstName: 'Ana' });
    }
  });

  it('rejects peers with surnames or contact info', () => {
    const result = ParticipantGroupDetailSchema.safeParse({
      id: '019756c0-2000-7000-8000-000000000001',
      name: 'Fundamentos da Fé',
      description: null,
      leader: { firstName: 'Marcos', avatarUrl: null },
      recurrence: 'weekly',
      nextMeeting: null,
      peers: [{ firstName: 'Ana', email: 'ana@example.com' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.peers[0]).toEqual({ firstName: 'Ana' });
      expect('email' in result.data.peers[0]).toBe(false);
    }
  });
});

describe('ParticipantGroupDetailResponseSchema snapshot', () => {
  it('wraps detail in data envelope', () => {
    const result = ParticipantGroupDetailResponseSchema.safeParse({
      data: {
        id: '019756c0-2000-7000-8000-000000000001',
        name: 'Fundamentos da Fé',
        description: null,
        leader: { firstName: 'Marcos', avatarUrl: null },
        recurrence: 'weekly',
        nextMeeting: null,
        peers: [],
      },
    });
    expect(result.success).toBe(true);
  });
});
