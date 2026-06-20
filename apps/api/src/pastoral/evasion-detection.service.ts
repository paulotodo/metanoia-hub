import { Injectable, Logger } from '@nestjs/common';
import { EvasionRiskRepository } from './repositories/evasion-risk.repository';
import { RadarStatusRepository } from './radar/radar-status.repository';
import { PastoralRiskEventPublisher } from './pastoral-risk-event-publisher.service';
import type { ParticipantRiskReason } from '@metanoia/types';

const CONSECUTIVE_ABSENCE_THRESHOLD = 3;
// INACTIVITY_DAYS is implicit in EvasionRiskRepository.getParticipantActivity (14 days)

export interface EvasionEvaluationResult {
  participantId: string;
  groupId: string;
  previousStatus: string | null;
  newStatus: string | null; // null = no change
  riskReason: ParticipantRiskReason | null;
  action:
    | 'flagged'
    | 'resolved'
    | 'no-change'
    | 'skipped-manual-override'
    | 'skipped-on-break';
}

@Injectable()
export class EvasionDetectionService {
  private readonly logger = new Logger(EvasionDetectionService.name);

  constructor(
    private readonly evasionRepo: EvasionRiskRepository,
    private readonly radarStatusRepo: RadarStatusRepository,
    private readonly eventPublisher: PastoralRiskEventPublisher,
  ) {}

  /**
   * Evaluates a single participant/group pair for evasion risk.
   * Called per-participant by the BullMQ job.
   * tenantId is injected via RequestContext (AsyncLocalStorage) by the job,
   * or passed explicitly via opts for job boundary context.
   */
  async evaluateParticipant(
    participantId: string,
    groupId: string,
    opts: { tenantId?: string; jobRunId?: string } = {},
  ): Promise<EvasionEvaluationResult> {
    // 1. Get current radar status
    const current = await this.evasionRepo.getCurrentRadarStatus(participantId, groupId, opts);
    const currentStatus = current?.status ?? 'verde';

    // 2. Guard: skip if manual override within 24h
    if (current?.manual_override_at) {
      const overrideAge = Date.now() - new Date(current.manual_override_at).getTime();
      if (overrideAge < 24 * 60 * 60 * 1000) {
        return {
          participantId,
          groupId,
          previousStatus: currentStatus,
          newStatus: null,
          riskReason: null,
          action: 'skipped-manual-override',
        };
      }
    }

    // 3. Check consecutive absences (also returns groupIsOnBreak)
    const absenceResult = await this.evasionRepo.getConsecutiveAbsences(
      participantId,
      groupId,
      CONSECUTIVE_ABSENCE_THRESHOLD,
      opts,
    );

    if (absenceResult.groupIsOnBreak) {
      return {
        participantId,
        groupId,
        previousStatus: currentStatus,
        newStatus: null,
        riskReason: null,
        action: 'skipped-on-break',
      };
    }

    // 4. Evaluate criteria
    const hasAbsences = absenceResult.consecutiveAbsences >= CONSECUTIVE_ABSENCE_THRESHOLD;
    const activity = await this.evasionRepo.getParticipantActivity(participantId, opts);
    const hasInactivity = activity.isInactive;

    // 5. Check resolution: 2 recent presences => back to verde
    if (currentStatus !== 'verde') {
      const recentPresences = await this.evasionRepo.countRecentPresences(
        participantId,
        groupId,
        2,
        opts,
      );
      if (recentPresences >= 2) {
        const previousStatus = currentStatus;
        await this.radarStatusRepo.upsertRisk(
          participantId,
          groupId,
          { status: 'verde', riskReason: null, manualOverrideAt: null },
          opts,
        );

        // FASE 8.2: Emit risk-resolved domain event
        if (previousStatus === 'amarelo' || previousStatus === 'vermelho') {
          await this.eventPublisher.publishRiskResolved(
            participantId,
            groupId,
            opts.tenantId ?? '',
            previousStatus as 'amarelo' | 'vermelho',
            opts.jobRunId,
          );
        }

        return {
          participantId,
          groupId,
          previousStatus,
          newStatus: 'verde',
          riskReason: null,
          action: 'resolved',
        };
      }
    }

    // 6. Determine new status based on criteria
    let newStatus: string | null = null;
    let riskReason: ParticipantRiskReason | null = null;

    if (hasAbsences && hasInactivity) {
      riskReason = 'absences+inactivity';
      newStatus = 'vermelho';
    } else if (hasAbsences) {
      riskReason = 'absences';
      // verde => amarelo; amarelo => vermelho (escalation)
      newStatus = currentStatus === 'verde' ? 'amarelo' : 'vermelho';
    } else if (hasInactivity) {
      riskReason = 'inactivity';
      newStatus = currentStatus === 'verde' ? 'amarelo' : 'vermelho';
    }

    // 7. No risk detected, or status unchanged
    if (!newStatus || newStatus === currentStatus) {
      return {
        participantId,
        groupId,
        previousStatus: currentStatus,
        newStatus: null,
        riskReason: null,
        action: 'no-change',
      };
    }

    // 8. Persist new status
    await this.radarStatusRepo.upsertRisk(
      participantId,
      groupId,
      {
        status: newStatus as 'amarelo' | 'vermelho',
        riskReason,
        manualOverrideAt: null,
      },
      opts,
    );

    // FASE 8.1: Emit risk-detected domain event (dedup handled inside publisher)
    await this.eventPublisher.publishRiskDetected(
      participantId,
      groupId,
      opts.tenantId ?? '',
      riskReason as ParticipantRiskReason,
      newStatus as 'amarelo' | 'vermelho',
      opts.jobRunId,
    );

    this.logger.log(
      { participantId, groupId, previousStatus: currentStatus, newStatus, riskReason },
      'evasion_risk_flagged',
    );

    return {
      participantId,
      groupId,
      previousStatus: currentStatus,
      newStatus,
      riskReason,
      action: 'flagged',
    };
  }
}
