import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { BullMqService } from '../bullmq/bullmq.service';
import { NOTIFICATIONS_QUEUE_NAME, NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS, CRITICAL_NOTIFICATION_TYPES } from '@metanoia/types';
import type { NotificationJobPayload } from '@metanoia/types';

@Injectable()
export class DigestService implements OnModuleInit {
  private readonly logger = new Logger(DigestService.name);
  private queue!: Queue;
  private readonly digestWindowMs: number;

  private readonly criticalBackoffMs: number;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly configService: ConfigService,
  ) {
    this.digestWindowMs = this.configService.get<number>(
      'NOTIFICATION_DIGEST_WINDOW_MS',
      NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS,
    );
    // CHK050/SC-01: critical types (pastoral_alert, export_ready, system) use shorter backoff.
    // Default 5s * 3 retries = max 15s delivery time (within SC-01 ~1 min threshold).
    this.criticalBackoffMs = this.configService.get<number>(
      'EMAIL_CRITICAL_BACKOFF_MS',
      5000,
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
      type: type as NotificationJobPayload['type'], // Story 16-1: enable worker preference check
    };

    const isCritical = (CRITICAL_NOTIFICATION_TYPES as readonly string[]).includes(type);

    if (isCritical) {
      // Critical types: immediate delivery, shorter backoff (CHK050/SC-01).
      // EMAIL_CRITICAL_BACKOFF_MS=5s × 3 retries = max ~15s total (within SC-01 ~1 min).
      await this.queue.add('send-notification', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: this.criticalBackoffMs },
        removeOnFail: false,
      });
      this.logger.log({ notificationId, type, channel, criticalBackoffMs: this.criticalBackoffMs }, 'critical notification enqueued immediately');
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
