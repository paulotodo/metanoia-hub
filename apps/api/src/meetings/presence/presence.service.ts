import { Injectable, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import {
  computeAttendance,
  type MeetingAttendance as MeetingAttendanceDto,
  type PresenceSegment,
} from '@metanoia/types';
import type { MeetingAttendance } from '@prisma/client';
import { getRequestContext } from '../../common/context/request-context';
import { MeetingsRepository } from '../meetings.repository';
import { PresenceRepository } from './presence.repository';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    private readonly meetings: MeetingsRepository,
    private readonly presence: PresenceRepository,
  ) {}

  /**
   * Story 5.3 — aggregate `meeting_participants` join/left timestamps into
   * one `meeting_attendance` row per user. Idempotent: re-runs upsert the
   * latest computed values, so worker retries / final-flush after checkpoint
   * collapse to a single row.
   */
  async flushAttendance(meetingId: string): Promise<MeetingAttendance[]> {
    const meeting = await this.meetings.findById(meetingId);
    if (!meeting) {
      this.logger.warn({ meetingId }, 'flushAttendance: meeting not found');
      return [];
    }

    const events = await this.presence.listPresenceEventsByMeeting(meetingId);
    const meetingDurationSeconds = this.deriveMeetingDuration(meeting);
    // For final flush we close any open segment with meeting.endedAt (or
    // "now" if the meeting is still mid-flight at flush time).
    const closingIso = (meeting.endedAt ?? new Date()).toISOString();

    // Fold join/left events into PresenceSegment[] per user. The events are
    // ordered chronologically; an open `join` is paired with the next `left`
    // for the same user, otherwise left open (leftAt=null) so the calculator
    // treats it as a participant still connected.
    const byUser = new Map<string, PresenceSegment[]>();
    for (const ev of events) {
      const userId = ev.userId;
      if (!userId) continue;
      const list = byUser.get(userId) ?? [];
      const isJoin = ev.eventType === 'meetings.participant.joined';
      const tsIso = ev.createdAt.toISOString();

      if (isJoin) {
        list.push({ joinedAt: tsIso, leftAt: null });
      } else {
        // participant.left — close the latest open segment for this user.
        for (let i = list.length - 1; i >= 0; i--) {
          const seg = list[i];
          if (seg && seg.leftAt === null) {
            list[i] = { ...seg, leftAt: tsIso };
            break;
          }
        }
      }
      byUser.set(userId, list);
    }

    const results: MeetingAttendance[] = [];
    for (const [userId, segments] of byUser) {
      const closedSegments = segments.map((s) =>
        s.leftAt === null ? { ...s, leftAt: closingIso } : s,
      );
      const computed = computeAttendance({
        segments: closedSegments,
        meetingDurationSeconds,
      });
      if (!computed) continue;

      const row = await this.presence.upsertAttendance({
        id: uuidv7(),
        meetingId,
        userId,
        joinTime: new Date(computed.joinTime),
        leaveTime: new Date(computed.leaveTime),
        totalDurationSeconds: computed.totalDurationSeconds,
        presenceType: computed.presenceType,
        reconnections: computed.reconnections,
      });
      results.push(row);
    }

    this.logger.log(
      { meetingId, rowsWritten: results.length },
      'attendance flush completed',
    );

    return results;
  }

  /**
   * BullMQ checkpoint payload — a JSON snapshot of the in-flight attendance
   * computation. Survives crash recovery; the next worker run can re-flush
   * from `meeting_participants` (source of truth) using the snapshot only as
   * a hint for state debugging.
   */
  async checkpointSnapshot(meetingId: string): Promise<void> {
    const participants = await this.presence.listParticipantsByMeeting(meetingId);
    const ctx = getRequestContext();
    await this.presence.createSnapshot(
      meetingId,
      {
        tenantId: ctx.tenantId,
        capturedAt: new Date().toISOString(),
        participants: participants.map((p) => ({
          userId: p.userId,
          participantId: p.participantId,
          joinedAt: p.joinedAt?.toISOString() ?? null,
          leftAt: p.leftAt?.toISOString() ?? null,
        })),
      },
      uuidv7(),
    );
    this.logger.log({ meetingId }, 'checkpoint snapshot persisted');
  }

  async listAttendance(meetingId: string): Promise<MeetingAttendanceDto[]> {
    const rows = await this.presence.listAttendanceByMeeting(meetingId);
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      meetingId: r.meetingId,
      userId: r.userId,
      joinTime: r.joinTime.toISOString(),
      leaveTime: r.leaveTime.toISOString(),
      totalDurationSeconds: r.totalDurationSeconds,
      presenceType: r.presenceType as MeetingAttendanceDto['presenceType'],
      reconnections: r.reconnections,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private deriveMeetingDuration(meeting: {
    scheduledFor: Date;
    durationMinutes: number | null;
    startedAt: Date | null;
    endedAt: Date | null;
  }): number {
    // Prefer actual wall-clock when both timestamps exist; fall back to the
    // scheduled duration; final fallback: zero (no minutes set → presence
    // can only be `parcial` until duration is known).
    if (meeting.startedAt && meeting.endedAt) {
      const diffMs = meeting.endedAt.getTime() - meeting.startedAt.getTime();
      return Math.max(0, Math.round(diffMs / 1000));
    }
    if (meeting.durationMinutes) {
      return meeting.durationMinutes * 60;
    }
    return 0;
  }
}
