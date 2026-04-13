import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  RadarPageData,
  SignalDetail,
  ParticipantProfile,
  CareActionResponse,
  RadarParticipant,
  PresenceDot,
  CareActionType,
  SignalType,
  SignalVariant,
} from '@metanoia/types';
import type { PastoralNote } from '@prisma/client';
import { PastoralRepository } from './pastoral.repository';
import { requestContext } from '../common/context/request-context';

@Injectable()
export class PastoralService {
  constructor(private readonly repository: PastoralRepository) {}

  async getRadarPage(groupId?: string): Promise<RadarPageData> {
    const [alerts, groups] = await Promise.all([
      this.repository.findActiveAlerts(groupId),
      this.repository.findGroupsByTenant(),
    ]);

    const participants: RadarParticipant[] = [];

    for (const alert of alerts) {
      const lastAction = await this.repository.findLastCareAction(alert.participantId);

      participants.push({
        participantId: alert.participantId,
        name: alert.participant.name,
        signalType: alert.signalType as SignalType,
        contextPhrase: alert.contextPhrase,
        groupId: alert.group.id,
        groupName: alert.group.name,
        presenceDots: alert.presenceDots as PresenceDot[],
        lastCareRecord: lastAction
          ? {
              date: lastAction.recordedAt.toISOString(),
              type: lastAction.actionType as CareActionType,
            }
          : null,
      });
    }

    const careUrgent = participants.filter((p) => p.signalType === 'care-urgent').length;
    const careAttention = participants.filter((p) => p.signalType === 'care-attention').length;
    const careOk = participants.filter((p) => p.signalType === 'care-ok').length;

    const ctx = requestContext.getStore();

    return {
      participants,
      groups: groups.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })),
      signalCounts: {
        careUrgent,
        careAttention,
        careOk,
        deltaUrgent: 0,
        deltaAttention: 0,
        deltaOk: 0,
      },
      userFirstName: ctx?.userId ?? '',
      lastSeenAt: null,
      nextMeeting: null,
    };
  }

  async getSignalDetail(participantId: string): Promise<SignalDetail> {
    const alert = await this.repository.findAlertByParticipant(participantId);
    if (!alert) {
      throw new NotFoundException('Signal not found for participant');
    }

    const lastAction = await this.repository.findLastCareAction(participantId);

    return {
      participantId: alert.participantId,
      name: alert.participant.name,
      signalType: alert.signalType as SignalType,
      groupId: alert.groupId,
      groupName: alert.group.name,
      observedFact: {
        variant: (alert.signalVariant ?? 'fallback') as SignalVariant,
        text: alert.observedFact ?? '',
      },
      systemLimitation: {
        text: alert.systemLimitation ?? 'O radar vê presença e ausência — não sabe o motivo.',
      },
      presenceDots: alert.presenceDots as PresenceDot[],
      lastCareRecord: lastAction
        ? {
            date: lastAction.recordedAt.toISOString(),
            type: lastAction.actionType as CareActionType,
          }
        : null,
    };
  }

  async getParticipantProfile(participantId: string): Promise<ParticipantProfile> {
    const alert = await this.repository.findAlertByParticipant(participantId);
    if (!alert) {
      throw new NotFoundException('Participant not found');
    }

    const notes = await this.repository.findNotesByParticipant(participantId);

    const lastConversation = (notes as PastoralNote[]).find((n) => n.noteType === 'conversation');
    const lastPrayer = (notes as PastoralNote[]).find((n) => n.noteType === 'prayer');
    const nextMilestone = (notes as PastoralNote[]).find((n) => n.noteType === 'milestone');

    return {
      participantId: alert.participantId,
      name: alert.participant.name,
      signalType: alert.signalType as SignalType,
      groupName: alert.group.name,
      presenceDots: alert.presenceDots as PresenceDot[],
      memory: {
        lastConversation: lastConversation
          ? {
              date: lastConversation.occurredAt.toISOString(),
              note: lastConversation.content,
            }
          : null,
        lastPrayer: lastPrayer
          ? {
              date: lastPrayer.occurredAt.toISOString(),
              note: lastPrayer.content,
            }
          : null,
        nextMilestone: nextMilestone
          ? {
              date: nextMilestone.occurredAt.toISOString(),
              dayOfWeek: (nextMilestone.metadata as { dayOfWeek?: string })?.dayOfWeek ?? '',
              eventName: (nextMilestone.metadata as { eventName?: string })?.eventName ?? '',
            }
          : null,
      },
    };
  }

  async recordCareAction(
    participantId: string,
    dto: { participantId: string; groupId: string; signalType: SignalType; note: string },
  ): Promise<CareActionResponse> {
    const ctx = requestContext.getStore();
    if (!ctx?.userId || !ctx?.tenantId) {
      throw new NotFoundException('User context not available');
    }

    return this.repository.createCareAction({
      participantId,
      groupId: dto.groupId,
      performedBy: ctx.userId,
      actionType: 'message',
      signalType: dto.signalType,
      note: dto.note,
      tenantId: ctx.tenantId,
    });
  }
}
