import { Injectable } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminPastoralRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Church overview ---------------------------------------------------

  async findAllGroupsWithLeader() {
    return this.prisma.tenant.group.findMany({
      orderBy: { name: 'asc' },
      include: {
        members: {
          where: { role: 'lider' },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });
  }

  async findLatestMeetingByGroup(groupId: string) {
    return this.prisma.tenant.meeting.findFirst({
      where: { groupId, status: 'ended' },
      orderBy: { scheduledFor: 'desc' },
      include: {
        participants: {
          select: { id: true, response: true, joinedAt: true },
        },
      },
    });
  }

  async countActiveAlertsByGroup(groupId: string) {
    return this.prisma.tenant.pastoralAlert.groupBy({
      by: ['signalType'],
      where: { groupId, active: true },
      _count: { _all: true },
    });
  }

  // --- Group timeline ----------------------------------------------------

  async findGroupById(groupId: string) {
    return this.prisma.tenant.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { role: 'lider' },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });
  }

  async findMeetingsForTimeline(
    groupId: string,
    windowStart: Date,
    windowEnd: Date,
  ) {
    return this.prisma.tenant.meeting.findMany({
      where: {
        groupId,
        status: 'ended',
        scheduledFor: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { scheduledFor: 'desc' },
      include: {
        participants: {
          select: { id: true, response: true, joinedAt: true },
        },
        reflections: {
          select: { text: true },
          take: 1,
        },
      },
    });
  }

  async findCareActionsForGroup(
    groupId: string,
    windowStart: Date,
    windowEnd: Date,
  ) {
    return this.prisma.tenant.pastoralAction.findMany({
      where: {
        groupId,
        recordedAt: { gte: windowStart, lte: windowEnd },
      },
      orderBy: { recordedAt: 'desc' },
      include: {
        participant: { select: { name: true } },
      },
    });
  }

  // --- Leader view -------------------------------------------------------

  async findLeaderProfile(leaderId: string) {
    return this.prisma.tenant.groupMember.findFirst({
      where: { userId: leaderId, role: 'lider' },
      include: {
        user: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });
  }

  async findLastConversation(leaderId: string) {
    return this.prisma.tenant.pastoralNote.findFirst({
      where: { participantId: leaderId, noteType: 'conversation' },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async findRecentActivity(leaderId: string, limit: number) {
    return this.prisma.tenant.pastoralAction.findMany({
      where: { performedBy: leaderId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  // --- OutreachIntent CRUD ----------------------------------------------

  async findCurrentWeekIntent(
    targetLeaderId: string,
    createdByUserId: string,
    weekStart: Date,
    weekEnd: Date,
  ) {
    return this.prisma.tenant.outreachIntent.findFirst({
      where: {
        targetLeaderId,
        createdByUserId,
        weekOf: { gte: weekStart, lt: weekEnd },
      },
      orderBy: { weekOf: 'desc' },
    });
  }

  async createOutreachIntent(data: {
    tenantId: string;
    createdByUserId: string;
    targetLeaderId: string;
    weekOf: Date;
    note: string;
  }) {
    return this.prisma.tenant.outreachIntent.create({
      data: {
        id: generateId(),
        tenantId: data.tenantId,
        createdByUserId: data.createdByUserId,
        targetLeaderId: data.targetLeaderId,
        weekOf: data.weekOf,
        note: data.note,
      },
    });
  }

  async findOutreachIntentById(intentId: string) {
    return this.prisma.tenant.outreachIntent.findUnique({
      where: { id: intentId },
    });
  }

  async updateOutreachIntent(intentId: string, note: string) {
    return this.prisma.tenant.outreachIntent.update({
      where: { id: intentId },
      data: { note },
    });
  }

  async deleteOutreachIntent(intentId: string) {
    return this.prisma.tenant.outreachIntent.delete({
      where: { id: intentId },
    });
  }
}
