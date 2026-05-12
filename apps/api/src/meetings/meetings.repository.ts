import { Injectable } from '@nestjs/common';
import type { Meeting, MeetingParticipantRecord, Prisma } from '@prisma/client';
import { getRequestContext } from '../common/context/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

export interface MeetingWithGroupAndParticipants extends Meeting {
  group: { id: string; name: string };
  participants: MeetingParticipantRecord[];
}

export interface ListMeetingsFilters {
  page: number;
  perPage: number;
  status?: string;
  groupId?: string;
}

export interface ListMeetingsResult {
  rows: Meeting[];
  total: number;
}

export interface UpdateMeetingPatch {
  title?: string | null;
  scheduledFor?: Date;
  durationMinutes?: number | null;
  topic?: string | null;
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
    title?: string | null;
    durationMinutes?: number | null;
    createdBy?: string | null;
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
          title: input.title ?? null,
          durationMinutes: input.durationMinutes ?? null,
          createdBy: input.createdBy ?? null,
        },
      }),
    );
  }

  async list(filters: ListMeetingsFilters): Promise<ListMeetingsResult> {
    const skip = (filters.page - 1) * filters.perPage;
    const where: Prisma.MeetingWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.groupId) where.groupId = filters.groupId;

    return withTenantTx(this.prisma, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.meeting.findMany({
          where,
          orderBy: { scheduledFor: 'desc' },
          skip,
          take: filters.perPage,
        }),
        tx.meeting.count({ where }),
      ]);
      return { rows, total };
    });
  }

  async update(id: string, patch: UpdateMeetingPatch): Promise<Meeting | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.meeting.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.meeting.update({ where: { id }, data: patch });
    });
  }

  async markCancelled(id: string, cancelledAt: Date): Promise<Meeting | null> {
    return withTenantTx(this.prisma, async (tx) => {
      const existing = await tx.meeting.findFirst({ where: { id } });
      if (!existing) return null;
      return tx.meeting.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt },
      });
    });
  }
}
