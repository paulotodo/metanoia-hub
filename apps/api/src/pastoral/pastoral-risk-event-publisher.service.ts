import { Injectable, Logger } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import {
  RiskDetectedEventSchema,
  RiskResolvedEventSchema,
  type RiskDetectedEvent,
  type RiskResolvedEvent,
} from '@metanoia/types';
import { RedisService } from '../redis/redis.service';

// Redis channel pattern: rt:pastoral-risk:{tenantId}
const PASTORAL_RISK_CHANNEL_PREFIX = 'rt:pastoral-risk';

// Dedup key: rt:risk-detected:{tenantId}:{participantId}:{groupId}:{yyyy-mm-dd}
const DEDUP_KEY_PREFIX = 'rt:risk-detected';
const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 24h

@Injectable()
export class PastoralRiskEventPublisher {
  private readonly logger = new Logger(PastoralRiskEventPublisher.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Publishes a risk-detected domain event.
   * Dedup: same participant/group/day combo is suppressed (TTL 24h).
   * No PII — only IDs in envelope data.
   */
  async publishRiskDetected(
    participantId: string,
    groupId: string,
    tenantId: string,
    riskReason: RiskDetectedEvent['data']['riskReason'],
    status: RiskDetectedEvent['data']['status'],
    jobRunId?: string,
  ): Promise<void> {
    // Dedup guard: one event per participant/group/day
    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
    const dedupKey = `${DEDUP_KEY_PREFIX}:${tenantId}:${participantId}:${groupId}:${today}`;
    const count = await this.redis.exists(dedupKey);
    if (count > 0) {
      this.logger.debug(
        { tenantId, participantId, groupId, dedupKey },
        'risk-detected suppressed by dedup',
      );
      return;
    }

    const now = new Date().toISOString();
    const envelope: RiskDetectedEvent = {
      eventId: generateId(),
      eventType: 'pastoral.participant.risk-detected',
      version: 1,
      tenantId,
      timestamp: now,
      data: {
        participantId,
        groupId,
        riskReason,
        status,
        detectedAt: now,
      },
      metadata: {
        source: 'detect-evasion-risk',
        ...(jobRunId !== undefined ? { jobRunId } : {}),
      },
    };

    // Validate envelope (fail schema = log + skip, never aborts the job)
    const parsed = RiskDetectedEventSchema.safeParse(envelope);
    if (!parsed.success) {
      this.logger.error(
        { tenantId, participantId, groupId, errors: parsed.error.flatten() },
        'risk-detected schema validation failed — event skipped',
      );
      return;
    }

    // Publish to Redis pub/sub channel
    const channelKey = `${PASTORAL_RISK_CHANNEL_PREFIX}:${tenantId}`;
    await this.redis.publish(channelKey, JSON.stringify(parsed.data));

    // Mark dedup key with 24h TTL
    await this.redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS);

    this.logger.log(
      { tenantId, participantId, groupId, riskReason, status, eventId: parsed.data.eventId },
      'pastoral.participant.risk-detected published',
    );
  }

  /**
   * Publishes a risk-resolved domain event.
   * No dedup — resolution events can be re-emitted safely.
   */
  async publishRiskResolved(
    participantId: string,
    groupId: string,
    tenantId: string,
    previousStatus: RiskResolvedEvent['data']['previousStatus'],
    jobRunId?: string,
  ): Promise<void> {
    const now = new Date().toISOString();
    const envelope: RiskResolvedEvent = {
      eventId: generateId(),
      eventType: 'pastoral.participant.risk-resolved',
      version: 1,
      tenantId,
      timestamp: now,
      data: {
        participantId,
        groupId,
        previousStatus,
        resolvedAt: now,
      },
      metadata: {
        source: 'detect-evasion-risk',
        ...(jobRunId !== undefined ? { jobRunId } : {}),
      },
    };

    // Validate envelope
    const parsed = RiskResolvedEventSchema.safeParse(envelope);
    if (!parsed.success) {
      this.logger.error(
        { tenantId, participantId, groupId, errors: parsed.error.flatten() },
        'risk-resolved schema validation failed — event skipped',
      );
      return;
    }

    const channelKey = `${PASTORAL_RISK_CHANNEL_PREFIX}:${tenantId}`;
    await this.redis.publish(channelKey, JSON.stringify(parsed.data));

    this.logger.log(
      { tenantId, participantId, groupId, previousStatus, eventId: parsed.data.eventId },
      'pastoral.participant.risk-resolved published',
    );
  }
}
