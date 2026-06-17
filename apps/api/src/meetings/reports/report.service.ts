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
  type MeetingReportParticipantFR63,
  type MeetingReportMetrics,
  computeParticipantEngagement,
  classifyEngagementLevel,
} from '@metanoia/types';
import { MeetingsRepository } from '../meetings.repository';
import { ReportRepository } from './report.repository';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { PrismaService } from '../../prisma/prisma.service';
import { getRequestContext } from '../../common/context/request-context';

/**
 * FR63 full leader view response shape (Story 13-1).
 */
export interface MeetingLeaderReportData {
  meetingId: string;
  metrics: MeetingReportMetrics;
  participants: MeetingReportParticipantFR63[];
  generatedAt: string;
}

/**
 * Story 5.6 + FR63 — generates the post-meeting aggregated report and serves it
 * with role-based shaping:
 *   - canSeeFull=true  → full FR63 leader view with per-participant engagement
 *   - canSeeFull=false → personal view (Participante sees only their own row)
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly meetings: MeetingsRepository,
    private readonly reports: ReportRepository,
    private readonly prisma: PrismaService,
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
        name: null, // User names are joined in the FR63 full view below
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
    | { kind: 'full'; data: MeetingLeaderReportData }
    | { kind: 'personal'; data: MeetingReportPersonal }
  > {
    const row = await this.reports.findByMeeting(meetingId);
    if (!row) throw new NotFoundException('Report not generated yet');

    const summary = MeetingReportSummarySchema.parse(row.summary);

    if (canSeeFull) {
      // FR63: build leader view with per-participant engagement + user details
      const leaderData = await this.buildLeaderView(meetingId, summary, row.generatedAt);
      return { kind: 'full', data: leaderData };
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

  /**
   * FR63 (Task 2.1): Build the full leader view with per-participant engagement.
   * Joins user name+email from the users table via Prisma.
   * canSeeFull=true guarantees all attendees of the tenant are returned (CHK008).
   */
  private async buildLeaderView(
    meetingId: string,
    summary: MeetingReportSummary,
    generatedAt: Date,
  ): Promise<MeetingLeaderReportData> {
    const { tenantId } = getRequestContext();

    // Derive meeting duration for engagement calculation
    const meeting = await this.meetings.findById(meetingId);
    const meetingDurationSeconds = meeting ? this.deriveMeetingDuration(meeting) : 0;

    // Fetch user name+email + attendance times from DB
    const userIds = summary.attendees.map((a) => a.userId);
    const { userMap, attendanceMap } = await withTenantTx(this.prisma, async (tx) => {
      const users = userIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];

      const attendance = userIds.length > 0
        ? await tx.meetingAttendance.findMany({
            where: { meetingId, tenantId },
            select: { userId: true, joinTime: true, leaveTime: true },
          })
        : [];

      return {
        userMap: new Map(users.map((u) => [u.id, u])),
        attendanceMap: new Map(
          attendance.map((a) => [a.userId, {
            joinedAt: a.joinTime instanceof Date ? a.joinTime.toISOString() : String(a.joinTime),
            leftAt: a.leaveTime instanceof Date ? a.leaveTime.toISOString() : String(a.leaveTime),
          }]),
        ),
      };
    });

    // Map attendees to FR63 participant shape
    const participants: MeetingReportParticipantFR63[] = summary.attendees.map((a) => {
      const engagement = computeParticipantEngagement(
        a.durationSeconds,
        a.cameraSeconds,
        meetingDurationSeconds,
      );
      const attendanceTimes = attendanceMap.get(a.userId);
      const userInfo = userMap.get(a.userId);

      return {
        userId: a.userId,
        name: userInfo?.name ?? null,
        email: userInfo?.email ?? null,
        status: a.presenceType,
        joinedAt: attendanceTimes?.joinedAt ?? null,
        leftAt: attendanceTimes?.leftAt ?? null,
        durationSeconds: a.durationSeconds,
        engagementScore: engagement?.score ?? null,
        engagementLevel: engagement?.level ?? null,
      };
    });

    // Aggregate metrics
    const totalParticipants = participants.length;
    const presentCount = participants.filter((p) => p.status === 'integral').length;
    const partialCount = participants.filter((p) => p.status === 'parcial').length;
    const absentCount = participants.filter((p) => p.status === 'ausente').length;
    const attendanceRate = totalParticipants > 0
      ? Math.round(((presentCount + partialCount) / totalParticipants) * 1000) / 1000
      : 0;

    const scoredParticipants = participants.filter((p) => p.engagementScore !== null);
    const avgEngagementScore = scoredParticipants.length > 0
      ? Math.round(
          (scoredParticipants.reduce((sum, p) => sum + (p.engagementScore ?? 0), 0) /
            scoredParticipants.length) *
            1000,
        ) / 1000
      : null;
    const avgEngagementLevel = avgEngagementScore !== null
      ? classifyEngagementLevel(avgEngagementScore)
      : null;

    const metrics: MeetingReportMetrics = {
      totalParticipants,
      presentCount,
      partialCount,
      absentCount,
      attendanceRate,
      avgEngagementScore,
      avgEngagementLevel,
    };

    return {
      meetingId,
      metrics,
      participants,
      generatedAt: generatedAt.toISOString(),
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
