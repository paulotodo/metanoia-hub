import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { RadarStatus, RadarTrend } from '@prisma/client';
import { AlertsRepository, type PastoralAlertRow, type StatusImprovedRow } from './alerts.repository';

/** Domain event emitted on positive status transitions (for Story 6-5 CelebrationBanner). */
export interface StatusImprovedEvent {
  eventType: 'pastoral.participant.status_improved';
  version: 1;
  tenantId: string;
  groupId: string;
  participantId: string;
  previousStatus: RadarStatus;
  newStatus: RadarStatus;
  trend: RadarTrend;
  timestamp: string;
}

/** Result of processTransition call. */
export interface TransitionResult {
  direction: 'negative' | 'positive' | 'neutral';
  alertId: string | null;
  event: StatusImprovedEvent | null;
}

const STATUS_WEIGHT: Record<RadarStatus, number> = {
  verde: 3,
  amarelo: 2,
  vermelho: 1,
};

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly repo: AlertsRepository) {}

  /**
   * Processes a status transition for a participant:
   * - Negative transition → creates alert (with dedup)
   * - Positive transition → emits domain event (Story 6-5 consumer)
   * - Neutral (same status) → no action
   *
   * Called by RadarCalculatorService after status upsert.
   */
  async processTransition(
    tenantId: string,
    groupId: string,
    participantId: string,
    previousStatus: RadarStatus | null,
    newStatus: RadarStatus,
    trend: RadarTrend,
  ): Promise<TransitionResult> {
    // No previous status — first calculation, no transition to process
    if (!previousStatus) {
      return { direction: 'neutral', alertId: null, event: null };
    }

    const prevWeight = STATUS_WEIGHT[previousStatus];
    const newWeight = STATUS_WEIGHT[newStatus];

    if (newWeight < prevWeight) {
      // Negative transition: verde→amarelo or amarelo→vermelho
      const alertId = await this.repo.createIfNotDuplicate({
        tenantId,
        groupId,
        participantId,
        previousStatus,
        newStatus,
        trend,
      });

      if (alertId) {
        this.logger.log(
          { tenantId, groupId, participantId, previousStatus, newStatus, alertId },
          'pastoral alert created for negative transition',
        );
      } else {
        this.logger.debug(
          { tenantId, groupId, participantId, previousStatus, newStatus },
          'alert suppressed by dedup',
        );
      }

      return { direction: 'negative', alertId, event: null };
    }

    if (newWeight > prevWeight) {
      // Positive transition: vermelho→amarelo or amarelo→verde
      // Persist to participant_status_improved for CelebrationBanner (Story 6-5)
      await this.repo.createStatusImproved({
        tenantId,
        groupId,
        participantId,
        previousStatus,
        newStatus,
        trend,
      });

      const event: StatusImprovedEvent = {
        eventType: 'pastoral.participant.status_improved',
        version: 1,
        tenantId,
        groupId,
        participantId,
        previousStatus,
        newStatus,
        trend,
        timestamp: new Date().toISOString(),
      };

      this.logger.log(
        { tenantId, groupId, participantId, previousStatus, newStatus },
        'pastoral.participant.status_improved persisted for CelebrationBanner',
      );

      return { direction: 'positive', alertId: null, event };
    }

    // Neutral: same status
    return { direction: 'neutral', alertId: null, event: null };
  }

  /**
   * Returns active alerts for a group (not dismissed).
   */
  async getGroupAlerts(groupId: string): Promise<PastoralAlertRow[]> {
    return this.repo.findActiveByGroup(groupId);
  }

  /**
   * Marks an alert as read.
   */
  async markRead(alertId: string): Promise<void> {
    try {
      await this.repo.markRead(alertId);
    } catch {
      throw new NotFoundException(`Alerta ${alertId} não encontrado`);
    }
  }

  /**
   * Dismisses an alert.
   */
  async dismiss(alertId: string): Promise<void> {
    try {
      await this.repo.dismiss(alertId);
    } catch {
      throw new NotFoundException(`Alerta ${alertId} não encontrado`);
    }
  }

  /**
   * Returns recent unseen positive transitions for CelebrationBanner.
   * Delegates to repository which filters by tenant context (RLS) + last 24h + seenAt IS NULL.
   */
  async findRecentPositiveTransitions(groupId?: string): Promise<StatusImprovedRow[]> {
    return this.repo.findRecentPositiveTransitions(groupId);
  }

  /**
   * Marks a status_improved event as seen (CelebrationBanner dismissed).
   */
  async markStatusImprovedSeen(id: string): Promise<void> {
    try {
      await this.repo.markStatusImprovedSeen(id);
    } catch {
      throw new NotFoundException(`Evento de melhoria ${id} não encontrado`);
    }
  }
}
