import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import type { MeetingReport as MeetingReportRow } from '@prisma/client';
import {
  MeetingReportSummarySchema,
  computeReportSummary,
  type MeetingReportPersonal,
  type MeetingReportSummary,
  type PresenceType,
  type ReportInputRow,
} from '@metanoia/types';
import { MeetingsRepository } from '../meetings.repository';
import { ReportRepository } from './report.repository';

/**
 * Story 5.6 — generates the post-meeting aggregated report and serves it
 * with role-based shaping (full for Líder/Admin, personal for Participante).
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly meetings: MeetingsRepository,
    private readonly reports: ReportRepository,
  ) {}

  /**
   * Idempotent flush — aggregates `meeting_attendance` + `meeting_telemetry`
   * for the meeting and upserts the JSONB summary. Called by
   * `MeetingsService.endRoom` (non-blocking).
   */
  async flushReport(meetingId: string): Promise<MeetingReportRow | null> {
    const meeting = await this.meetings.findById(meetingId);
    if (!meeting) {
      this.logger.warn({ meetingId }, 'flushReport: meeting not found');
      return null;
    }

    const { attendance, telemetry } =
      await this.reports.listAttendanceTelemetry(meetingId);

    // Index telemetry by userId for O(1) joins.
    const telemetryByUser = new Map<string, (typeof telemetry)[number]>();
    for (const t of telemetry) telemetryByUser.set(t.userId, t);

    const rows: ReportInputRow[] = attendance.map((a) => {
      const tel = telemetryByUser.get(a.userId);
      const focus =
        tel && tel.focusScore !== null ? Number(tel.focusScore) : null;
      return {
        userId: a.userId,
        name: null, // User names are out of scope — wire via users join in Epic 13 reports
        presenceType: a.presenceType as PresenceType,
        durationSeconds: a.totalDurationSeconds,
        cameraSeconds: tel?.cameraOnSeconds ?? 0,
        focusScore: focus,
      };
    });

    const meetingDurationSeconds = this.deriveMeetingDuration(meeting);
    const summary = computeReportSummary({
      rows,
      meetingDurationSeconds,
    });

    // Parse-validate before persistence (defense-in-depth — even though
    // computeReportSummary is pure, future callers may diverge).
    const parsed = MeetingReportSummarySchema.parse(summary);

    const persisted = await this.reports.upsertReport({
      id: uuidv7(),
      meetingId,
      summary: parsed as unknown as object,
    });
    this.logger.log(
      { meetingId, attendees: parsed.attendees.length },
      'report flushed',
    );
    return persisted;
  }

  async findForUser(
    meetingId: string,
    requesterUserId: string,
    canSeeFull: boolean,
  ): Promise<
    | { kind: 'full'; data: { id: string; meetingId: string; summary: MeetingReportSummary; generatedAt: string } }
    | { kind: 'personal'; data: MeetingReportPersonal }
  > {
    const row = await this.reports.findByMeeting(meetingId);
    if (!row) throw new NotFoundException('Report not generated yet');

    const summary = MeetingReportSummarySchema.parse(row.summary);

    if (canSeeFull) {
      return {
        kind: 'full',
        data: {
          id: row.id,
          meetingId: row.meetingId,
          summary,
          generatedAt: row.generatedAt.toISOString(),
        },
      };
    }

    const mine = summary.attendees.find((a) => a.userId === requesterUserId);
    if (!mine) {
      throw new NotFoundException('No attendance record for requester');
    }
    return {
      kind: 'personal',
      data: {
        meetingId: row.meetingId,
        attendee: mine,
        generatedAt: row.generatedAt.toISOString(),
      },
    };
  }

  private deriveMeetingDuration(meeting: {
    durationMinutes: number | null;
    startedAt: Date | null;
    endedAt: Date | null;
  }): number {
    if (meeting.startedAt && meeting.endedAt) {
      const diffMs = meeting.endedAt.getTime() - meeting.startedAt.getTime();
      return Math.max(0, Math.round(diffMs / 1000));
    }
    if (meeting.durationMinutes) return meeting.durationMinutes * 60;
    return 0;
  }
}
