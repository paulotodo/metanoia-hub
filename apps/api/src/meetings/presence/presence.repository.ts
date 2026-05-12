import { Injectable } from '@nestjs/common';
import type { MeetingAttendance, MeetingSnapshot, Prisma } from '@prisma/client';
import { getRequestContext } from '../../common/context/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';

export interface AttendanceUpsertInput {
  id: string;
  meetingId: string;
  userId: string;
  joinTime: Date;
  leaveTime: Date;
  totalDurationSeconds: number;
  presenceType: string;
  reconnections: number;
}

@Injectable()
export class PresenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listParticipantsByMeeting(meetingId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingParticipantRecord.findMany({
        where: { meetingId },
        orderBy: { joinedAt: 'asc' },
      }),
    );
  }

  /**
   * Story 5.3 — pull ordered presence events (joined/left) from
   * `meeting_events`. Each row is one segment boundary; PresenceService
   * folds them into PresenceSegment[] per user.
   */
  async listPresenceEventsByMeeting(meetingId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingEvent.findMany({
        where: {
          meetingId,
          eventType: {
            in: ['meetings.participant.joined', 'meetings.participant.left'],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async upsertAttendance(
    input: AttendanceUpsertInput,
  ): Promise<MeetingAttendance> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingAttendance.upsert({
        where: {
          meetingId_userId: {
            meetingId: input.meetingId,
            userId: input.userId,
          },
        },
        create: {
          id: input.id,
          tenantId,
          meetingId: input.meetingId,
          userId: input.userId,
          joinTime: input.joinTime,
          leaveTime: input.leaveTime,
          totalDurationSeconds: input.totalDurationSeconds,
          presenceType: input.presenceType,
          reconnections: input.reconnections,
        },
        update: {
          joinTime: input.joinTime,
          leaveTime: input.leaveTime,
          totalDurationSeconds: input.totalDurationSeconds,
          presenceType: input.presenceType,
          reconnections: input.reconnections,
        },
      }),
    );
  }

  async listAttendanceByMeeting(meetingId: string): Promise<MeetingAttendance[]> {
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingAttendance.findMany({
        where: { meetingId },
        orderBy: { joinTime: 'asc' },
      }),
    );
  }

  async createSnapshot(
    meetingId: string,
    data: Prisma.InputJsonValue,
    id: string,
  ): Promise<MeetingSnapshot> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingSnapshot.create({
        data: {
          id,
          tenantId,
          meetingId,
          snapshotData: data,
        },
      }),
    );
  }
}
