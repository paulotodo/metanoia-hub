import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { generateId } from '@metanoia/types';
import { RedisService } from '../../redis/redis.service';
import { BullMqService } from '../../bullmq/bullmq.service';
import { getRequestContext } from '../../common/context/request-context';

const MEETINGS_QUEUE = 'meetings';

export interface ParticipantJoinedData {
  meetingId: string;
  userId: string;
  eventType: string;
  payload: Record<string, unknown>;
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

  async handleParticipantJoined(data: ParticipantJoinedData): Promise<void> {
    const ctx = getRequestContext();
    const { tenantId } = ctx;
    const { meetingId, userId, eventType, payload } = data;

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
}
