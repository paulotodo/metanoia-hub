import { Injectable } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

@Injectable()
export class AdminPastoralRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Church overview ---------------------------------------------------

  async findAllGroupsWithLeader() {
    return withTenantTx(this.prisma, (tx) =>
      tx.group.findMany({
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
      }),
    );
  }

  async findLatestMeetingByGroup(groupId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.meeting.findFirst({
        where: { groupId, status: 'ended' },
        orderBy: { scheduledFor: 'desc' },
        include: {
          participants: {
            select: { id: true, response: true, joinedAt: true },
          },
        },
      }),
    );
  }

  async countActiveAlertsByGroup(groupId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.groupBy({
        by: ['signalType'],
        where: { groupId, active: true },
        _count: { _all: true },
      }),
    );
  }

  // --- Group timeline ----------------------------------------------------

  async findGroupById(groupId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.group.findUnique({
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
      }),
    );
  }

  async findMeetingsForTimeline(
    groupId: string,
    windowStart: Date,
    windowEnd: Date,
  ) {
    return withTenantTx(this.prisma, (tx) =>
      tx.meeting.findMany({
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
      }),
    );
  }

  async findCareActionsForGroup(
    groupId: string,
    windowStart: Date,
    windowEnd: Date,
  ) {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralAction.findMany({
        where: {
          groupId,
          recordedAt: { gte: windowStart, lte: windowEnd },
        },
        orderBy: { recordedAt: 'desc' },
        include: {
          participant: { select: { name: true } },
        },
      }),
    );
  }

  // --- Leader view -------------------------------------------------------

  async findLeaderProfile(leaderId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.groupMember.findFirst({
        where: { userId: leaderId, role: 'lider' },
        include: {
          user: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      }),
    );
  }

  async findLastConversation(leaderId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralNote.findFirst({
        where: { participantId: leaderId, noteType: 'conversation' },
        orderBy: { occurredAt: 'desc' },
      }),
    );
  }

  async findRecentActivity(leaderId: string, limit: number) {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralAction.findMany({
        where: { performedBy: leaderId },
        orderBy: { recordedAt: 'desc' },
        take: limit,
      }),
    );
  }

  // --- OutreachIntent CRUD ----------------------------------------------

  async findCurrentWeekIntent(
    targetLeaderId: string,
    createdByUserId: string,
    weekStart: Date,
    weekEnd: Date,
  ) {
    return withTenantTx(this.prisma, (tx) =>
      tx.outreachIntent.findFirst({
        where: {
          targetLeaderId,
          createdByUserId,
          weekOf: { gte: weekStart, lt: weekEnd },
        },
        orderBy: { weekOf: 'desc' },
      }),
    );
  }

  async createOutreachIntent(data: {
    tenantId: string;
    createdByUserId: string;
    targetLeaderId: string;
    weekOf: Date;
    note: string;
  }) {
    return withTenantTx(this.prisma, (tx) =>
      tx.outreachIntent.create({
        data: {
          id: generateId(),
          tenantId: data.tenantId,
          createdByUserId: data.createdByUserId,
          targetLeaderId: data.targetLeaderId,
          weekOf: data.weekOf,
          note: data.note,
        },
      }),
    );
  }

  async findOutreachIntentById(intentId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.outreachIntent.findUnique({
        where: { id: intentId },
      }),
    );
  }

  async updateOutreachIntent(intentId: string, note: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.outreachIntent.update({
        where: { id: intentId },
        data: { note },
      }),
    );
  }

  async deleteOutreachIntent(intentId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.outreachIntent.delete({
        where: { id: intentId },
      }),
    );
  }
}
