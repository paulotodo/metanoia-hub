import { Injectable } from '@nestjs/common';
import type { Meeting, MeetingParticipantRecord } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';

export interface MeetingWithGroupAndParticipants extends Meeting {
  group: { id: string; name: string };
  participants: MeetingParticipantRecord[];
}

/**
 * MeetingsRepository — all queries go through the RLS-aware client
 * (`prisma.tenant`) so tenant_id filtering is automatic via the Prisma extension.
 * INSERTs still need to populate tenant_id explicitly — read it from RequestContext.
 */
@Injectable()
export class MeetingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDetailById(meetingId: string): Promise<MeetingWithGroupAndParticipants | null> {
    const meeting = await this.prisma.tenant.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: { orderBy: { name: 'asc' } },
      },
    });
    if (!meeting) return null;

    const group = await this.prisma.tenant.group.findUnique({
      where: { id: meeting.groupId },
      select: { id: true, name: true },
    });
    if (!group) return null;

    return { ...meeting, group };
  }

  async findById(meetingId: string): Promise<Meeting | null> {
    return this.prisma.tenant.meeting.findUnique({ where: { id: meetingId } });
  }

  async markRoomOpened(
    meetingId: string,
    livekitRoomId: string,
    startedAt: Date,
  ): Promise<Meeting> {
    return this.prisma.tenant.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'live',
        livekitRoomId,
        startedAt,
      },
    });
  }

  async markRoomEnded(meetingId: string, endedAt: Date): Promise<Meeting> {
    return this.prisma.tenant.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'ended',
        endedAt,
      },
    });
  }

  async createMeeting(input: {
    id: string;
    groupId: string;
    scheduledFor: Date;
    topic: string | null;
  }): Promise<Meeting> {
    const { tenantId } = getRequestContext();
    return this.prisma.tenant.meeting.create({
      data: {
        id: input.id,
        tenantId,
        groupId: input.groupId,
        scheduledFor: input.scheduledFor,
        topic: input.topic,
      },
    });
  }
}
