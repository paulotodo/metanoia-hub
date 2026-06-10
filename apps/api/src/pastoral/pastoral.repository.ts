import { Injectable } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import type {
  CareActionType,
  SignalType,
} from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';

export interface NudgeCandidate {
  participantId: string;
  participantName: string;
  groupId: string;
  status: string;
  trend: string;
  presenceDots: string[];
  lastActiveAt: Date | null;
  calculatedAt: Date;
}

@Injectable()
export class PastoralRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveAlerts(groupId?: string) {
    const where: Record<string, unknown> = { active: true };
    if (groupId) where.groupId = groupId;

    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.findMany({
        where,
        include: {
          participant: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
        orderBy: [
          { signalType: 'asc' }, // care-urgent first (alphabetical)
          { updatedAt: 'desc' },
        ],
      }),
    );
  }

  async findAlertByParticipant(participantId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.findFirst({
        where: { participantId, active: true },
        include: {
          participant: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      }),
    );
  }

  async findLastCareAction(participantId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralAction.findFirst({
        where: { participantId },
        orderBy: { recordedAt: 'desc' },
      }),
    );
  }

  async findNotesByParticipant(participantId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralNote.findMany({
        where: { participantId },
        orderBy: { occurredAt: 'desc' },
      }),
    );
  }

  /**
   * Fetches all pastoral care actions for a participant, ordered chronologically descending.
   * Used to build the merged individual timeline (Story 6-4).
   */
  async findCareActionsByParticipant(participantId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.pastoralAction.findMany({
        where: { participantId },
        orderBy: { recordedAt: 'desc' },
      }),
    );
  }

  /**
   * Fetches meeting attendance records for a participant (presence signals),
   * ordered chronologically descending.
   * MeetingAttendance has no Prisma relation to Meeting — meetingId is a raw FK.
   * Used to build the merged individual timeline (Story 6-4).
   */
  async findAttendanceByParticipant(participantId: string) {
    return withTenantTx(this.prisma, (tx) =>
      tx.meetingAttendance.findMany({
        where: { userId: participantId },
        orderBy: { joinTime: 'desc' },
      }),
    );
  }

  async findGroupsByTenant() {
    return withTenantTx(this.prisma, (tx) =>
      tx.group.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  /**
   * Returns radar status rows with participant name for nudge computation.
   * Fetches all participants with their radar status + last active + presence dots.
   * Story 6-5 — NudgePastoral.
   */
  async findNudgeCandidates(groupId?: string): Promise<NudgeCandidate[]> {
    const rows = await withTenantTx(this.prisma, (tx) =>
      tx.participantRadarStatus.findMany({
        where: groupId ? { groupId } : {},
        include: {
          participant: { select: { name: true } },
        },
        orderBy: { calculatedAt: 'desc' },
      }),
    );

    // Get presence dots from the most recent active alert per participant
    const alertsByParticipant = await withTenantTx(this.prisma, (tx) =>
      tx.pastoralAlert.findMany({
        where: {
          ...(groupId ? { groupId } : {}),
          active: true,
        },
        select: {
          participantId: true,
          presenceDots: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
    );

    const presenceDotsMap = new Map<string, string[]>();
    for (const alert of alertsByParticipant) {
      if (!presenceDotsMap.has(alert.participantId)) {
        presenceDotsMap.set(alert.participantId, alert.presenceDots as string[]);
      }
    }

    return rows.map((r) => ({
      participantId: r.participantId,
      participantName: (r as typeof r & { participant: { name: string } }).participant.name,
      groupId: r.groupId,
      status: r.status,
      trend: r.trend,
      presenceDots: presenceDotsMap.get(r.participantId) ?? [],
      lastActiveAt: r.lastActiveAt,
      calculatedAt: r.calculatedAt,
    }));
  }

  async createCareAction(data: {
    participantId: string;
    groupId: string;
    performedBy: string;
    actionType: CareActionType;
    signalType: SignalType;
    note: string;
    tenantId: string;
  }) {
    const id = generateId();
    const action = await withTenantTx(this.prisma, (tx) =>
      tx.pastoralAction.create({
        data: {
          id,
          tenantId: data.tenantId,
          participantId: data.participantId,
          groupId: data.groupId,
          performedBy: data.performedBy,
          actionType: data.actionType,
          signalType: data.signalType,
          note: data.note,
        },
      }),
    );

    return { careActionId: action.id, recordedAt: action.recordedAt.toISOString() };
  }
}
