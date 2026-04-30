import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ParticipantGroupsRepository — read-only queries scoped to the current
 * authenticated user. Tenant isolation is enforced by RLS via the Prisma
 * extension; on top of that, every query filters by the requesting user's
 * GroupMember rows so participants only see groups they belong to.
 */
@Injectable()
export class ParticipantGroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List groups the user is a member of, with leader (role='lider') and the
   * next upcoming meeting (status='scheduled', scheduledFor >= now) included.
   */
  async findGroupsForUser(userId: string) {
    return this.prisma.tenant.group.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: 'asc' },
      include: {
        members: {
          where: { role: 'lider' },
          take: 1,
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });
  }

  /**
   * Detail view: returns the group only if `userId` is a member of it
   * (membership check is enforced in the WHERE clause to avoid leaking
   * existence). Includes leader, all members (for peers), and next meeting.
   */
  async findGroupForUser(groupId: string, userId: string) {
    return this.prisma.tenant.group.findFirst({
      where: {
        id: groupId,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  /**
   * Returns the next meeting (scheduledFor >= now, status='scheduled')
   * for a given group, or null. Separated from the group query because
   * Prisma cannot easily express "first meeting in the future" via include.
   */
  async findNextMeeting(groupId: string) {
    return this.prisma.tenant.meeting.findFirst({
      where: {
        groupId,
        status: 'scheduled',
        scheduledFor: { gte: new Date() },
      },
      orderBy: { scheduledFor: 'asc' },
      select: {
        id: true,
        scheduledFor: true,
        livekitRoomId: true,
      },
    });
  }
}
