import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId } from '@metanoia/types';
import { requestContext } from '../../../common/context/request-context';
import { PresenceService } from '../presence.service';

const TENANT = '01912345-6789-7000-8000-000000000001';
const MEETING = '01912345-6789-7000-8000-000000000100';
const USER_1 = '01912345-6789-7000-8000-000000000aa1';
const USER_2 = '01912345-6789-7000-8000-000000000aa2';

function buildMocks() {
  const meetings = {
    findById: vi.fn(),
  };
  const presence = {
    listParticipantsByMeeting: vi.fn(),
    listPresenceEventsByMeeting: vi.fn(),
    upsertAttendance: vi.fn(),
    createSnapshot: vi.fn(),
    listAttendanceByMeeting: vi.fn(),
  };
  const service = new PresenceService(meetings as never, presence as never);
  return { service, meetings, presence };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT,
      userId: 'system',
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('PresenceService', () => {
  let env: ReturnType<typeof buildMocks>;

  beforeEach(() => {
    env = buildMocks();
  });

  describe('flushAttendance', () => {
    it('returns [] when meeting not found', async () => {
      env.meetings.findById.mockResolvedValue(null);
      const result = await withCtx(() => env.service.flushAttendance(MEETING));
      expect(result).toEqual([]);
      expect(env.presence.upsertAttendance).not.toHaveBeenCalled();
    });

    it('folds join/left events into per-user segments and upserts one attendance row', async () => {
      env.meetings.findById.mockResolvedValue({
        scheduledFor: new Date('2026-04-20T19:30:00.000Z'),
        durationMinutes: 60,
        startedAt: new Date('2026-04-20T19:30:00.000Z'),
        endedAt: new Date('2026-04-20T20:30:00.000Z'),
      });
      env.presence.listPresenceEventsByMeeting.mockResolvedValue([
        {
          userId: USER_1,
          eventType: 'meetings.participant.joined',
          createdAt: new Date('2026-04-20T19:30:00.000Z'),
        },
        {
          userId: USER_1,
          eventType: 'meetings.participant.left',
          createdAt: new Date('2026-04-20T20:18:00.000Z'), // 48 min = 80%
        },
      ]);
      env.presence.upsertAttendance.mockImplementation(async (input) => ({
        ...input,
        tenantId: TENANT,
        createdAt: new Date(),
      }));

      await withCtx(() => env.service.flushAttendance(MEETING));

      expect(env.presence.upsertAttendance).toHaveBeenCalledOnce();
      const call = env.presence.upsertAttendance.mock.calls[0]![0];
      expect(call.userId).toBe(USER_1);
      expect(call.presenceType).toBe('integral');
      expect(call.totalDurationSeconds).toBe(2880);
    });

    it('closes open segments using meeting.endedAt for participants without explicit leave', async () => {
      env.meetings.findById.mockResolvedValue({
        scheduledFor: new Date('2026-04-20T19:30:00.000Z'),
        durationMinutes: 60,
        startedAt: new Date('2026-04-20T19:30:00.000Z'),
        endedAt: new Date('2026-04-20T20:30:00.000Z'),
      });
      env.presence.listPresenceEventsByMeeting.mockResolvedValue([
        {
          userId: USER_2,
          eventType: 'meetings.participant.joined',
          createdAt: new Date('2026-04-20T19:30:00.000Z'),
        },
        // No left event → service closes with meeting.endedAt (60 min total)
      ]);
      env.presence.upsertAttendance.mockImplementation(async (input) => ({
        ...input,
        tenantId: TENANT,
        createdAt: new Date(),
      }));

      await withCtx(() => env.service.flushAttendance(MEETING));

      const call = env.presence.upsertAttendance.mock.calls[0]![0];
      expect(call.totalDurationSeconds).toBe(3600);
      expect(call.presenceType).toBe('integral');
    });

    it('handles two users with distinct segment structures', async () => {
      env.meetings.findById.mockResolvedValue({
        scheduledFor: new Date('2026-04-20T19:30:00.000Z'),
        durationMinutes: 60,
        startedAt: new Date('2026-04-20T19:30:00.000Z'),
        endedAt: new Date('2026-04-20T20:30:00.000Z'),
      });
      env.presence.listPresenceEventsByMeeting.mockResolvedValue([
        {
          userId: USER_1,
          eventType: 'meetings.participant.joined',
          createdAt: new Date('2026-04-20T19:30:00.000Z'),
        },
        {
          userId: USER_1,
          eventType: 'meetings.participant.left',
          createdAt: new Date('2026-04-20T19:45:00.000Z'),
        },
        {
          userId: USER_2,
          eventType: 'meetings.participant.joined',
          createdAt: new Date('2026-04-20T19:30:00.000Z'),
        },
        {
          userId: USER_2,
          eventType: 'meetings.participant.left',
          createdAt: new Date('2026-04-20T20:30:00.000Z'),
        },
      ]);
      env.presence.upsertAttendance.mockImplementation(async (input) => ({
        ...input,
        tenantId: TENANT,
        createdAt: new Date(),
      }));

      await withCtx(() => env.service.flushAttendance(MEETING));

      expect(env.presence.upsertAttendance).toHaveBeenCalledTimes(2);
      const types = env.presence.upsertAttendance.mock.calls.map(
        (c) => (c[0] as { presenceType: string }).presenceType,
      );
      expect(types).toEqual(['parcial', 'integral']);
    });
  });

  describe('checkpointSnapshot', () => {
    it('persists snapshot JSON with tenantId + participant snapshot', async () => {
      env.presence.listParticipantsByMeeting.mockResolvedValue([
        {
          userId: USER_1,
          participantId: USER_1,
          joinedAt: new Date('2026-04-20T19:30:00.000Z'),
          leftAt: null,
        },
      ]);
      env.presence.createSnapshot.mockResolvedValue({});

      await withCtx(() => env.service.checkpointSnapshot(MEETING));

      expect(env.presence.createSnapshot).toHaveBeenCalledOnce();
      const [meetingArg, dataArg] = env.presence.createSnapshot.mock.calls[0]!;
      expect(meetingArg).toBe(MEETING);
      const data = dataArg as { tenantId: string; participants: unknown[] };
      expect(data.tenantId).toBe(TENANT);
      expect(data.participants).toHaveLength(1);
    });
  });
});
