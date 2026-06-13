import { describe, it, expect, vi } from 'vitest';
import { MeetingsService } from '../meetings.service';

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const MEETING_ID = '01912345-6789-7000-8000-000000000020';
const RECORD_ID = '01912345-6789-7000-8000-000000000021';

function makePrisma(
  attendanceRows: unknown[],
  meetingRows: unknown[],
  participantRecords: unknown[],
) {
  return {
    client: {
      meetingAttendance: { findMany: vi.fn().mockResolvedValue(attendanceRows) },
      meeting: { findMany: vi.fn().mockResolvedValue(meetingRows) },
      meetingParticipantRecord: { findMany: vi.fn().mockResolvedValue(participantRecords) },
    },
  };
}

function makeService(prisma: unknown) {
  return new MeetingsService(
    {} as never, // repository
    {} as never, // videoProvider
    {} as never, // eventEmitter
    {} as never, // presence
    {} as never, // checkpoint
    {} as never, // telemetry
    {} as never, // report
    {} as never, // reminder
    prisma as never,
  );
}

describe('MeetingsService.exportUserData', () => {
  it('returns attendance and participantRecords with ISO 8601 dates', async () => {
    const attendance = [
      {
        meetingId: MEETING_ID,
        presenceType: 'integral',
        joinTime: new Date('2026-03-01T09:00:00.000Z'),
        leaveTime: new Date('2026-03-01T10:00:00.000Z'),
      },
    ];
    const meetings = [{ id: MEETING_ID, title: 'Reunião Semanal' }];
    const records = [
      {
        id: RECORD_ID,
        meetingId: MEETING_ID,
        joinedAt: new Date('2026-03-01T09:01:00.000Z'),
        leftAt: new Date('2026-03-01T09:59:00.000Z'),
      },
    ];

    const prisma = makePrisma(attendance, meetings, records);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.attendance).toHaveLength(1);
    expect(result.attendance[0].meetingId).toBe(MEETING_ID);
    expect(result.attendance[0].title).toBe('Reunião Semanal');
    expect(result.attendance[0].presenceType).toBe('integral');
    expect(result.attendance[0].joinTime).toBe('2026-03-01T09:00:00.000Z');
    expect(result.attendance[0].leaveTime).toBe('2026-03-01T10:00:00.000Z');

    expect(result.participantRecords).toHaveLength(1);
    expect(result.participantRecords[0].id).toBe(RECORD_ID);
    expect(result.participantRecords[0].joinedAt).toBe('2026-03-01T09:01:00.000Z');
    expect(result.participantRecords[0].leftAt).toBe('2026-03-01T09:59:00.000Z');
    expect(result.participantRecords[0].duration).toBeNull();
  });

  it('handles nullable userId on participantRecords via { equals: userId }', async () => {
    const prisma = makePrisma([], [], []);
    const svc = makeService(prisma);

    await svc.exportUserData(USER_ID, TENANT_ID);

    expect(prisma.client.meetingParticipantRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: { equals: USER_ID }, tenantId: TENANT_ID },
      }),
    );
  });

  it('returns empty arrays when user has no data', async () => {
    const prisma = makePrisma([], [], []);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.attendance).toHaveLength(0);
    expect(result.participantRecords).toHaveLength(0);
  });

  it('maps joinedAt and leftAt as null when absent on participantRecord', async () => {
    const records = [
      {
        id: RECORD_ID,
        meetingId: MEETING_ID,
        joinedAt: null,
        leftAt: null,
      },
    ];
    const prisma = makePrisma([], [], records);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.participantRecords[0].joinedAt).toBeNull();
    expect(result.participantRecords[0].leftAt).toBeNull();
  });

  it('skips bulk meeting fetch when attendance is empty', async () => {
    const prisma = makePrisma([], [], []);
    const svc = makeService(prisma);

    await svc.exportUserData(USER_ID, TENANT_ID);

    expect(prisma.client.meeting.findMany).not.toHaveBeenCalled();
  });
});
