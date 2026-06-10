import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

export interface RecentMeetingAttendance {
  participantId: string;
  meetingId: string;
  presentForSeconds: number;
  attendedAt: Date;
}

export interface MeetingWindow {
  meetingId: string;
  scheduledFor: Date;
}

@Injectable()
export class RadarCalculatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the N most recent completed meetings for a group.
   * Used to define the attendance window for radar calculation.
   */
  async findRecentMeetingsForGroup(
    groupId: string,
    limit: number,
  ): Promise<MeetingWindow[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.meeting.findMany({
        where: { groupId, status: 'ended' },
        orderBy: { scheduledFor: 'desc' },
        take: limit,
        select: { id: true, scheduledFor: true },
      }),
    ).then((meetings) =>
      meetings.map((m) => ({ meetingId: m.id, scheduledFor: m.scheduledFor })),
    );
  }

  /**
   * Returns attendance records for a specific set of meetings.
   * Includes all participants who had attendance records.
   */
  async findAttendanceForMeetings(
    meetingIds: string[],
  ): Promise<RecentMeetingAttendance[]> {
    if (meetingIds.length === 0) return [];

    return withTenantTx(this.prisma, (tx) =>
      tx.meetingAttendance.findMany({
        where: { meetingId: { in: meetingIds } },
        select: {
          userId: true,
          meetingId: true,
          totalDurationSeconds: true,
          createdAt: true,
        },
      }),
    ).then((records) =>
      records.map((r) => ({
        participantId: r.userId,
        meetingId: r.meetingId,
        presentForSeconds: r.totalDurationSeconds,
        attendedAt: r.createdAt,
      })),
    );
  }

  /**
   * Returns all distinct participant IDs associated with a group
   * via GroupMember records.
   */
  async findGroupMemberIds(groupId: string): Promise<string[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      }),
    ).then((members) => members.map((m) => m.userId));
  }
}
