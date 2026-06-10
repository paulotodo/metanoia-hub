import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { RADAR_CACHE_KEY_PREFIX } from '@metanoia/types';
import type { PastoralNote } from '@prisma/client';
import { PastoralRepository } from './pastoral.repository';
import { requestContext } from '../common/context/request-context';
import { RadarStatusRepository } from './radar/radar-status.repository';
import { RadarJobService } from './radar/radar-job.service';
import type { ParticipantCalculationResult } from './radar/radar-calculator.service';

@Injectable()
export class PastoralService {
  private readonly logger = new Logger(PastoralService.name);

  constructor(
    private readonly repository: PastoralRepository,
    private readonly radarStatusRepo: RadarStatusRepository,
    private readonly radarJobService: RadarJobService,
  ) {}

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

    const result = await this.repository.createCareAction({
      participantId,
      groupId: dto.groupId,
      performedBy: ctx.userId,
      actionType: 'message',
      signalType: dto.signalType,
      note: dto.note,
      tenantId: ctx.tenantId,
    });

    // Trigger async radar recalculation after a care action
    void this.radarJobService.enqueueRadarCalculation(ctx.tenantId, dto.groupId).catch((err) => {
      this.logger.warn({ error: (err as Error).message }, 'radar recalculation enqueue failed (non-blocking)');
    });

    return result;
  }

  /**
   * Returns radar status for all participants in a group.
   * Cache-first: reads from Redis; falls back to DB if cache is empty.
   */
  async getRadarStatus(
    groupId: string,
    redis: { get: (key: string) => Promise<string | null> },
  ): Promise<ParticipantCalculationResult[]> {
    const ctx = requestContext.getStore();
    if (!ctx?.tenantId) {
      throw new NotFoundException('Tenant context not available');
    }

    const cacheKey = `${RADAR_CACHE_KEY_PREFIX}:${ctx.tenantId}:${groupId}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as ParticipantCalculationResult[];
    }

    // Fallback to DB (stale or first load)
    const rows = await this.radarStatusRepo.findByGroup(groupId);
    return rows.map((r) => ({
      participantId: r.participantId,
      status: r.status,
      trend: r.trend,
      presencePercentage: r.presencePercentage.toNumber(),
      lastActiveAt: r.lastActiveAt,
    }));
  }
}
