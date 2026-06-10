import { Injectable, Logger } from '@nestjs/common';
import type { RadarStatus, RadarTrend } from '@prisma/client';
import {
  RADAR_GREEN_THRESHOLD,
  RADAR_RED_THRESHOLD,
  RADAR_ACTIVE_DAYS,
  RADAR_INACTIVE_DAYS,
  RADAR_MEETINGS_WINDOW,
} from '@metanoia/types';
import { RadarCalculatorRepository } from './radar-calculator.repository';
import { RadarStatusRepository } from './radar-status.repository';
import type { RecentMeetingAttendance, MeetingWindow } from './radar-calculator.repository';

export interface ParticipantCalculationResult {
  participantId: string;
  status: RadarStatus;
  trend: RadarTrend;
  presencePercentage: number;
  lastActiveAt: Date | null;
}

export interface GroupCalculationResult {
  tenantId: string;
  groupId: string;
  participants: ParticipantCalculationResult[];
  calculatedAt: Date;
}

@Injectable()
export class RadarCalculatorService {
  private readonly logger = new Logger(RadarCalculatorService.name);

  constructor(
    private readonly calculatorRepo: RadarCalculatorRepository,
    private readonly statusRepo: RadarStatusRepository,
  ) {}

  /**
   * Recalculates radar status for all participants in a group and persists results.
   * Called by BullMQ worker with tenant context set in AsyncLocalStorage.
   */
  async recalculate(tenantId: string, groupId: string): Promise<GroupCalculationResult> {
    this.logger.log({ tenantId, groupId }, 'radar recalculation started');

    // 1. Get recent meetings window (last N ended meetings)
    const recentMeetings = await this.calculatorRepo.findRecentMeetingsForGroup(
      groupId,
      RADAR_MEETINGS_WINDOW,
    );

    // 2. Get all group members
    const memberIds = await this.calculatorRepo.findGroupMemberIds(groupId);

    // 3. Get attendance records for those meetings
    const meetingIds = recentMeetings.map((m) => m.meetingId);
    const attendanceRecords = await this.calculatorRepo.findAttendanceForMeetings(meetingIds);

    // 4. Get previous statuses for trend comparison
    const previousStatuses = await this.statusRepo.findByGroup(groupId);
    const prevStatusMap = new Map(previousStatuses.map((s) => [s.participantId, s.status]));

    // 5. Calculate per-participant
    const results: ParticipantCalculationResult[] = memberIds.map((participantId) => {
      const result = this.calculateParticipant(
        participantId,
        recentMeetings,
        attendanceRecords,
        prevStatusMap.get(participantId) ?? null,
      );
      return result;
    });

    // 6. Persist all results
    for (const result of results) {
      await this.statusRepo.upsert({
        tenantId,
        groupId,
        participantId: result.participantId,
        status: result.status,
        trend: result.trend,
        presencePercentage: result.presencePercentage,
        lastActiveAt: result.lastActiveAt,
      });
    }

    this.logger.log(
      { tenantId, groupId, participantCount: results.length },
      'radar recalculation completed',
    );

    return {
      tenantId,
      groupId,
      participants: results,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculates radar status for a single participant.
   * Pure function — no side effects, easy to unit test.
   */
  calculateParticipant(
    participantId: string,
    meetings: MeetingWindow[],
    attendance: RecentMeetingAttendance[],
    previousStatus: RadarStatus | null,
  ): ParticipantCalculationResult {
    const participantAttendance = attendance.filter(
      (a) => a.participantId === participantId,
    );

    // Presence percentage: meetings attended / total meetings in window
    const totalMeetings = meetings.length;
    const attendedMeetings = participantAttendance.filter(
      (a) => a.presentForSeconds > 0,
    ).length;

    const presencePercentage = totalMeetings > 0 ? attendedMeetings / totalMeetings : 0;

    // Last active: most recent meeting where participant was present
    const presentRecords = participantAttendance
      .filter((a) => a.presentForSeconds > 0)
      .sort((a, b) => b.attendedAt.getTime() - a.attendedAt.getTime());

    const lastActiveAt = presentRecords.length > 0 ? presentRecords[0].attendedAt : null;

    // Inactivity in days
    const now = new Date();
    const daysSinceActive = lastActiveAt
      ? Math.floor((now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    // Status determination
    // Rule order: presence-based first, then inactivity can degrade (never improve)
    let status: RadarStatus;

    if (presencePercentage < RADAR_RED_THRESHOLD || daysSinceActive >= RADAR_INACTIVE_DAYS) {
      // <50% presence OR inactive >= 21 days → vermelho
      status = 'vermelho';
    } else if (
      presencePercentage >= RADAR_GREEN_THRESHOLD &&
      daysSinceActive < RADAR_ACTIVE_DAYS
    ) {
      // ≥75% presence AND active within 14 days → verde
      status = 'verde';
    } else {
      // Everything else: 50-74% presence, OR ≥75% presence but inactive 14-20 days
      status = 'amarelo';
    }

    // Trend: compare to previous status
    const trend = this.calculateTrend(status, previousStatus);

    return {
      participantId,
      status,
      trend,
      presencePercentage,
      lastActiveAt,
    };
  }

  private calculateTrend(
    currentStatus: RadarStatus,
    previousStatus: RadarStatus | null,
  ): RadarTrend {
    if (!previousStatus) return 'estavel';

    const statusWeight: Record<RadarStatus, number> = {
      verde: 3,
      amarelo: 2,
      vermelho: 1,
    };

    const current = statusWeight[currentStatus];
    const previous = statusWeight[previousStatus];

    if (current > previous) return 'melhorando';
    if (current < previous) return 'declinio';
    return 'estavel';
  }
}
