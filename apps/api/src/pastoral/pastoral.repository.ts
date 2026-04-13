import { Injectable } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import type {
  CareActionType,
  SignalType,
} from '@metanoia/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PastoralRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveAlerts(groupId?: string) {
    const where: Record<string, unknown> = { active: true };
    if (groupId) where.groupId = groupId;

    return this.prisma.tenant.pastoralAlert.findMany({
      where,
      include: {
        participant: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: [
        { signalType: 'asc' }, // care-urgent first (alphabetical)
        { updatedAt: 'desc' },
      ],
    });
  }

  async findAlertByParticipant(participantId: string) {
    return this.prisma.tenant.pastoralAlert.findFirst({
      where: { participantId, active: true },
      include: {
        participant: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
    });
  }

  async findLastCareAction(participantId: string) {
    return this.prisma.tenant.pastoralAction.findFirst({
      where: { participantId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async findNotesByParticipant(participantId: string) {
    return this.prisma.tenant.pastoralNote.findMany({
      where: { participantId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async findGroupsByTenant() {
    return this.prisma.tenant.group.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
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
    const action = await this.prisma.tenant.pastoralAction.create({
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
    });

    return { careActionId: action.id, recordedAt: action.recordedAt.toISOString() };
  }
}
