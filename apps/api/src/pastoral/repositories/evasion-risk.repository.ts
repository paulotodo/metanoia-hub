import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import type { TenantTx } from '../../prisma/with-tenant-tx';

export interface ConsecutiveAbsenceResult {
  consecutiveAbsences: number;
  groupIsOnBreak: boolean;
  breakUntil: Date | null;
}

export interface ParticipantActivityResult {
  lastSeenAt: Date | null;
  isInactive: boolean; // true if last_seen_at IS NULL or < 14 days ago
}

@Injectable()
export class EvasionRiskRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Counts consecutive absences of a participant in their last N meetings.
   * Meetings during group break are excluded from the window.
   * NOTE: tenantId is passed to withTenantTx opts for job context (not business logic).
   */
  async getConsecutiveAbsences(
    participantId: string,
    groupId: string,
    windowSize: number = 3,
    opts: { tenantId?: string } = {},
  ): Promise<ConsecutiveAbsenceResult> {
    return withTenantTx(
      this.prisma,
      async (tx: TenantTx) => {
        // Check group break status
        const group = await tx.$queryRawUnsafe<
          { status: string; break_until: Date | null }[]
        >(
          `SELECT status, break_until FROM groups WHERE id = $1::uuid LIMIT 1`,
          groupId,
        );
        const groupRow = group[0];
        const groupIsOnBreak = groupRow?.status === 'on_break';
        const breakUntil = groupRow?.break_until ?? null;

        // Get the last windowSize COMPLETED meetings for the group,
        // excluding meetings that occurred during a break period.
        const meetings = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT m.id
           FROM meetings m
           WHERE m.group_id = $1::uuid
             AND m.status = 'completed'
             AND ($2::timestamptz IS NULL OR m.started_at > $2::timestamptz)
           ORDER BY m.started_at DESC
           LIMIT $3`,
          groupId,
          breakUntil,
          windowSize,
        );

        if (meetings.length === 0) {
          return { consecutiveAbsences: 0, groupIsOnBreak, breakUntil };
        }

        const meetingIds = meetings.map((m) => m.id);

        // Count meetings where participant was present
        const attendanceRows = await tx.$queryRawUnsafe<{ meeting_id: string }[]>(
          `SELECT meeting_id::text FROM meeting_attendance
           WHERE user_id = $1::uuid
             AND meeting_id = ANY($2::uuid[])`,
          participantId,
          meetingIds,
        );

        const attendedIds = new Set(attendanceRows.map((r) => r.meeting_id));
        // Count CONSECUTIVE absences from the most recent meeting backwards
        let consecutiveAbsences = 0;
        for (const m of meetings) {
          if (!attendedIds.has(m.id)) {
            consecutiveAbsences++;
          } else {
            break; // presence breaks the consecutive streak
          }
        }

        return { consecutiveAbsences, groupIsOnBreak, breakUntil };
      },
      opts,
    );
  }

  async getParticipantActivity(
    participantId: string,
    opts: { tenantId?: string } = {},
  ): Promise<ParticipantActivityResult> {
    return withTenantTx(
      this.prisma,
      async (tx: TenantTx) => {
        const rows = await tx.$queryRawUnsafe<{ last_seen_at: Date | null }[]>(
          `SELECT last_seen_at FROM users WHERE id = $1::uuid LIMIT 1`,
          participantId,
        );
        const lastSeenAt = rows[0]?.last_seen_at ?? null;
        const isInactive =
          lastSeenAt === null ||
          lastSeenAt < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        return { lastSeenAt, isInactive };
      },
      opts,
    );
  }

  async getCurrentRadarStatus(
    participantId: string,
    groupId: string,
    opts: { tenantId?: string } = {},
  ) {
    return withTenantTx(
      this.prisma,
      async (tx: TenantTx) => {
        const rows = await tx.$queryRawUnsafe<
          {
            status: string;
            manual_override_at: Date | null;
            risk_reason: string | null;
          }[]
        >(
          `SELECT status, manual_override_at, risk_reason
           FROM participant_radar_status
           WHERE participant_id = $1::uuid
             AND group_id = $2::uuid
           LIMIT 1`,
          participantId,
          groupId,
        );
        return rows[0] ?? null;
      },
      opts,
    );
  }

  async countRecentPresences(
    participantId: string,
    groupId: string,
    windowSize: number = 2,
    opts: { tenantId?: string } = {},
  ): Promise<number> {
    return withTenantTx(
      this.prisma,
      async (tx: TenantTx) => {
        const meetings = await tx.$queryRawUnsafe<{ id: string }[]>(
          `SELECT m.id
           FROM meetings m
           WHERE m.group_id = $1::uuid
             AND m.status = 'completed'
           ORDER BY m.started_at DESC
           LIMIT $2`,
          groupId,
          windowSize,
        );
        if (meetings.length === 0) return 0;
        const meetingIds = meetings.map((m) => m.id);
        const rows = await tx.$queryRawUnsafe<{ count: string }[]>(
          `SELECT COUNT(*)::text as count FROM meeting_attendance
           WHERE user_id = $1::uuid
             AND meeting_id = ANY($2::uuid[])`,
          participantId,
          meetingIds,
        );
        return parseInt(rows[0]?.count ?? '0', 10);
      },
      opts,
    );
  }
}
