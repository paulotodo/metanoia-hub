import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { BullMqService } from '../bullmq/bullmq.service';
import { NOTIFICATIONS_QUEUE_NAME, NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS } from '@metanoia/types';
import type { NotificationJobPayload } from '@metanoia/types';

@Injectable()
export class DigestService implements OnModuleInit {
  private readonly logger = new Logger(DigestService.name);
  private queue!: Queue;
  private readonly digestWindowMs: number;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly configService: ConfigService,
  ) {
    this.digestWindowMs = this.configService.get<number>(
      'NOTIFICATION_DIGEST_WINDOW_MS',
      NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS,
    );
  }

  onModuleInit() {
    this.queue = this.bullMqService.createQueue(NOTIFICATIONS_QUEUE_NAME);
    this.logger.log({ digestWindowMs: this.digestWindowMs }, 'digest service initialized');
  }

  async enqueue(
    notificationId: string,
    userId: string,
    tenantId: string,
    type: string,
    channel: string,
    correlationId: string,
  ): Promise<void> {
    const payload: NotificationJobPayload = {
      notificationId,
      tenantId,
      userId,
      channel: channel as NotificationJobPayload['channel'],
      correlationId,
    };

    if (type === 'pastoral_alert') {
      // Immediate delivery — no delay, no deduplication key
      await this.queue.add('send-notification', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnFail: false,
      });
      this.logger.log({ notificationId, type, channel }, 'pastoral_alert enqueued immediately');
    } else {
      // Digest: deduplicate by user+type within the current time bucket
      const bucket = Math.floor(Date.now() / this.digestWindowMs);
      const jobKey = `digest:${userId}:${type}:${bucket}`;

      await this.queue.add('send-notification', payload, {
        jobId: jobKey,
        delay: this.digestWindowMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnFail: false,
      });
      this.logger.log({ notificationId, type, channel, jobKey }, 'notification enqueued with digest');
    }
  }
}
