import { describe, expect, it } from 'vitest';
import {
  PRESENCE_INTEGRAL_THRESHOLD,
  RECONNECTION_TOLERANCE_SECONDS,
  PresenceTypeSchema,
  PresenceSegmentSchema,
  MeetingAttendanceSchema,
  MeetingSnapshotSchema,
  computeAttendance,
} from '../presence';

describe('Presence constants (Story 5.3)', () => {
  it('integral threshold is 80%', () => {
    expect(PRESENCE_INTEGRAL_THRESHOLD).toBe(0.8);
  });

  it('reconnection tolerance is 120 seconds (2 min, FR48)', () => {
    expect(RECONNECTION_TOLERANCE_SECONDS).toBe(120);
  });
});

describe('PresenceTypeSchema snapshot', () => {
  it('freezes the enum values', () => {
    expect(PresenceTypeSchema.options).toMatchInlineSnapshot(`
      [
        "integral",
        "parcial",
        "ausente",
      ]
    `);
  });
});

describe('PresenceSegmentSchema snapshot', () => {
  it('accepts null leftAt for in-progress segments', () => {
    const ok = PresenceSegmentSchema.safeParse({
      joinedAt: '2026-04-20T19:30:00.000Z',
      leftAt: null,
    });
    expect(ok.success).toBe(true);
  });
});

describe('MeetingAttendanceSchema snapshot', () => {
  it('freezes the attendance row shape', () => {
    const ok = MeetingAttendanceSchema.safeParse({
      id: '019756c0-0002-7000-8000-000000000001',
      tenantId: '019756c0-0002-7000-8000-000000000aaa',
      meetingId: '019756c0-0002-7000-8000-000000000002',
      userId: '019756c0-0002-7000-8000-000000000bbb',
      joinTime: '2026-04-20T19:30:00.000Z',
      leaveTime: '2026-04-20T20:30:00.000Z',
      totalDurationSeconds: 3600,
      presenceType: 'integral',
      reconnections: 1,
      createdAt: '2026-04-20T20:31:00.000Z',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown presence type', () => {
    const fail = MeetingAttendanceSchema.safeParse({
      id: '019756c0-0002-7000-8000-000000000001',
      tenantId: '019756c0-0002-7000-8000-000000000aaa',
      meetingId: '019756c0-0002-7000-8000-000000000002',
      userId: '019756c0-0002-7000-8000-000000000bbb',
      joinTime: '2026-04-20T19:30:00.000Z',
      leaveTime: '2026-04-20T20:30:00.000Z',
      totalDurationSeconds: 0,
      presenceType: 'parcial-ish',
      reconnections: 0,
      createdAt: '2026-04-20T20:31:00.000Z',
    });
    expect(fail.success).toBe(false);
  });
});

describe('MeetingSnapshotSchema snapshot', () => {
  it('accepts arbitrary snapshotData', () => {
    const ok = MeetingSnapshotSchema.safeParse({
      id: '019756c0-0002-7000-8000-000000000001',
      tenantId: '019756c0-0002-7000-8000-000000000aaa',
      meetingId: '019756c0-0002-7000-8000-000000000002',
      snapshotData: { participants: [], capturedAt: '2026-04-20T19:35:00.000Z' },
      createdAt: '2026-04-20T19:35:01.000Z',
    });
    expect(ok.success).toBe(true);
  });
});

// --- Pure compute --------------------------------------------------------

describe('computeAttendance (Story 5.3 — FR48 reconnection tolerance)', () => {
  const MEETING_60_MIN = 3600;

  it('returns null when no segments', () => {
    expect(
      computeAttendance({ segments: [], meetingDurationSeconds: MEETING_60_MIN }),
    ).toBeNull();
  });

  it('classifies as integral when ≥ 80% duration', () => {
    const result = computeAttendance({
      segments: [
        {
          joinedAt: '2026-04-20T19:30:00.000Z',
          leftAt: '2026-04-20T20:18:00.000Z', // 48 min = 80% of 60
        },
      ],
      meetingDurationSeconds: MEETING_60_MIN,
    });
    expect(result?.presenceType).toBe('integral');
    expect(result?.totalDurationSeconds).toBe(2880);
    expect(result?.reconnections).toBe(0);
  });

  it('classifies as parcial when < 80% duration', () => {
    const result = computeAttendance({
      segments: [
        {
          joinedAt: '2026-04-20T19:30:00.000Z',
          leftAt: '2026-04-20T20:00:00.000Z', // 30 min = 50%
        },
      ],
      meetingDurationSeconds: MEETING_60_MIN,
    });
    expect(result?.presenceType).toBe('parcial');
    expect(result?.totalDurationSeconds).toBe(1800);
  });

  it('classifies as ausente when total duration is zero', () => {
    const result = computeAttendance({
      segments: [
        {
          joinedAt: '2026-04-20T19:30:00.000Z',
          leftAt: '2026-04-20T19:30:00.000Z',
        },
      ],
      meetingDurationSeconds: MEETING_60_MIN,
    });
    expect(result?.presenceType).toBe('ausente');
  });

  it('merges reconnection within tolerance — counts reconnection, no penalty', () => {
    const result = computeAttendance({
      segments: [
        {
          joinedAt: '2026-04-20T19:30:00.000Z',
          leftAt: '2026-04-20T19:31:00.000Z', // 1 min
        },
        {
          // Reconnected 90s later (< 120s tolerance)
          joinedAt: '2026-04-20T19:32:30.000Z',
          leftAt: '2026-04-20T20:18:00.000Z', // +45.5min
        },
      ],
      meetingDurationSeconds: MEETING_60_MIN,
    });
    // Continuous span: 19:30 → 20:18 = 48 min (no gap penalty)
    expect(result?.totalDurationSeconds).toBe(2880);
    expect(result?.reconnections).toBe(1);
    expect(result?.presenceType).toBe('integral');
  });

  it('treats reconnection outside tolerance as distinct segments', () => {
    const result = computeAttendance({
      segments: [
        {
          joinedAt: '2026-04-20T19:30:00.000Z',
          leftAt: '2026-04-20T19:40:00.000Z', // 10 min
        },
        {
          // Gap is 5 min > 120s tolerance
          joinedAt: '2026-04-20T19:45:00.000Z',
          leftAt: '2026-04-20T20:00:00.000Z', // 15 min
        },
      ],
      meetingDurationSeconds: MEETING_60_MIN,
    });
    expect(result?.totalDurationSeconds).toBe(25 * 60); // 10 + 15 = 25 min
    expect(result?.reconnections).toBe(0); // not a "reconnection", new segment
    expect(result?.presenceType).toBe('parcial');
  });

  it('honors custom tolerance + threshold overrides', () => {
    const result = computeAttendance({
      segments: [
        {
          joinedAt: '2026-04-20T19:30:00.000Z',
          leftAt: '2026-04-20T19:45:00.000Z', // 15 min = 25%
        },
      ],
      meetingDurationSeconds: MEETING_60_MIN,
      integralThreshold: 0.2,
    });
    expect(result?.presenceType).toBe('integral'); // 25% ≥ 20%
  });

  it('exposes earliest join and latest leave', () => {
    const result = computeAttendance({
      segments: [
        {
          joinedAt: '2026-04-20T19:30:00.000Z',
          leftAt: '2026-04-20T19:31:00.000Z',
        },
        {
          joinedAt: '2026-04-20T19:32:30.000Z',
          leftAt: '2026-04-20T20:18:00.000Z',
        },
      ],
      meetingDurationSeconds: MEETING_60_MIN,
    });
    expect(result?.joinTime).toBe('2026-04-20T19:30:00.000Z');
    expect(result?.leaveTime).toBe('2026-04-20T20:18:00.000Z');
  });
});
