import { Injectable } from '@nestjs/common';
import type { Meeting, MeetingParticipantRecord } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

export interface MeetingWithGroupAndParticipants extends Meeting {
  group: { id: string; name: string };
  participants: MeetingParticipantRecord[];
}

/**
 * MeetingsRepository — every read/write goes through `withTenantTx` so the
 * SET LOCAL app.current_tenant_id and the actual query share the same Postgres
 * connection. INSERTs still need to populate tenant_id explicitly — read it
 * from RequestContext.
 */
@Injectable()
export class MeetingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDetailById(meetingId: string): Promise<MeetingWithGroupAndParticipants | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const meeting = await tx.meeting.findUnique({
        where: { id: meetingId },
        include: {
          participants: { orderBy: { name: 'asc' } },
        },
      });
      if (!meeting) return null;

      const group = await tx.group.findUnique({
        where: { id: meeting.groupId },
        select: { id: true, name: true },
      });
      if (!group) return null;

      return { ...meeting, group };
    });
  }

  async findById(meetingId: string): Promise<Meeting | null> {
    return withTenantTx(this.prisma, (tx) =>
      tx.meeting.findUnique({ where: { id: meetingId } }),
    );
  }

  async markRoomOpened(
    meetingId: string,
    livekitRoomId: string,
    startedAt: Date,
  ): Promise<Meeting> {
    return withTenantTx(this.prisma, (tx) =>
      tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'live',
          livekitRoomId,
          startedAt,
        },
      }),
    );
  }

  async markRoomEnded(meetingId: string, endedAt: Date): Promise<Meeting> {
    return withTenantTx(this.prisma, (tx) =>
      tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: 'ended',
          endedAt,
        },
      }),
    );
  }

  async createMeeting(input: {
    id: string;
    groupId: string;
    scheduledFor: Date;
    topic: string | null;
  }): Promise<Meeting> {
    const { tenantId } = getRequestContext();
    return withTenantTx(this.prisma, (tx) =>
      tx.meeting.create({
        data: {
          id: input.id,
          tenantId,
          groupId: input.groupId,
          scheduledFor: input.scheduledFor,
          topic: input.topic,
        },
      }),
    );
  }
}
