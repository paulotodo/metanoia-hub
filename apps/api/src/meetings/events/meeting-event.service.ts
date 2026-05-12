import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { generateId } from '@metanoia/types';
import { RedisService } from '../../redis/redis.service';
import { BullMqService } from '../../bullmq/bullmq.service';
import { getRequestContext } from '../../common/context/request-context';

const MEETINGS_QUEUE = 'meetings';
const DEDUP_TTL_SECONDS = 3600;

export interface ParticipantJoinedData {
  meetingId: string;
  userId: string;
  eventType: string;
  payload: Record<string, unknown>;
  /** Provider-side event id for dedup via `webhook:{providerEventId}`. */
  providerEventId?: string;
}

export interface ParticipantLeftData {
  meetingId: string;
  userId: string;
  payload: Record<string, unknown>;
  providerEventId?: string;
}

@Injectable()
export class MeetingEventService {
  private readonly logger = new Logger(MeetingEventService.name);
  private readonly queue: Queue;

  constructor(
    private readonly redis: RedisService,
    bullMqService: BullMqService,
  ) {
    this.queue = bullMqService.createQueue(MEETINGS_QUEUE);
  }

  /**
   * Story 5.3 — dedup via Redis SETNX. Returns true if this is the first
   * time we see `providerEventId`, false on a duplicate (caller should
   * silently skip processing).
   */
  private async claimWebhook(providerEventId?: string): Promise<boolean> {
    if (!providerEventId) return true;
    const key = `webhook:${providerEventId}`;
    const result = await this.redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
    return result === 'OK';
  }

  async handleParticipantJoined(data: ParticipantJoinedData): Promise<void> {
    const ctx = getRequestContext();
    const { tenantId } = ctx;
    const { meetingId, userId, eventType, payload, providerEventId } = data;

    const isFirst = await this.claimWebhook(providerEventId);
    if (!isFirst) {
      this.logger.warn(
        { tenantId, meetingId, providerEventId },
        'webhook dedup: duplicate skipped',
      );
      return;
    }

    // Step 1: Store presence in Redis
    const presenceKey = `rt:meeting:${tenantId}:${meetingId}:presence`;
    await this.redis.hset(presenceKey, userId, JSON.stringify({
      joinedAt: new Date().toISOString(),
      ...payload,
    }));
    this.logger.log({ tenantId, meetingId, userId }, 'presence stored in redis');

    // Step 2: Publish event for SSE subscribers
    const channelKey = `rt:meeting:${tenantId}:${meetingId}:events`;
    const eventId = generateId();
    const event = {
      eventId,
      eventType,
      version: 1,
      tenantId,
      meetingId,
      userId,
      timestamp: new Date().toISOString(),
      data: payload,
    };
    await this.redis.publish(channelKey, JSON.stringify(event));
    this.logger.log({ tenantId, meetingId, eventId }, 'event published to redis channel');

    // Step 3: Enqueue BullMQ job for PostgreSQL flush
    const job = await this.queue.add('participant-joined', event);
    this.logger.log({ tenantId, meetingId, eventId, jobId: job.id }, 'bullmq job enqueued');
  }

  async handleParticipantLeft(data: ParticipantLeftData): Promise<void> {
    const ctx = getRequestContext();
    const { tenantId } = ctx;
    const { meetingId, userId, payload, providerEventId } = data;

    const isFirst = await this.claimWebhook(providerEventId);
    if (!isFirst) {
      this.logger.warn(
        { tenantId, meetingId, providerEventId },
        'webhook dedup: duplicate skipped',
      );
      return;
    }

    const presenceKey = `rt:meeting:${tenantId}:${meetingId}:presence`;
    const raw = await this.redis.hget(presenceKey, userId);
    const prior = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    await this.redis.hset(
      presenceKey,
      userId,
      JSON.stringify({
        ...prior,
        leftAt: new Date().toISOString(),
        ...payload,
      }),
    );
    this.logger.log({ tenantId, meetingId, userId }, 'leave recorded in redis');

    const channelKey = `rt:meeting:${tenantId}:${meetingId}:events`;
    const eventId = generateId();
    const event = {
      eventId,
      eventType: 'meetings.participant.left',
      version: 1,
      tenantId,
      meetingId,
      userId,
      timestamp: new Date().toISOString(),
      data: payload,
    };
    await this.redis.publish(channelKey, JSON.stringify(event));

    const job = await this.queue.add('participant-left', event);
    this.logger.log(
      { tenantId, meetingId, eventId, jobId: job.id },
      'bullmq participant-left job enqueued',
    );
  }
}
