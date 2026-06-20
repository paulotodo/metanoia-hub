import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Worker } from 'bullmq';
import { generateId, NOTIFICATIONS_QUEUE_NAME, type NotificationJobPayload } from '@metanoia/types';
import { BullMqService } from '../bullmq/bullmq.service';
import { requestContext } from '../common/context/request-context';
import { ChannelRouter } from './channel-router';
import { NotificationsService } from './notifications.service';

/**
 * NotificationsWorker — BullMQ consumer for the `notifications` queue.
 *
 * Each job carries a NotificationJobPayload (notificationId, tenantId, userId,
 * channel, correlationId). The worker rebuilds RequestContext from the payload
 * (identical pattern to MeetingEventWorker) so RLS policies apply correctly.
 *
 * Retry config (set at enqueue time by DigestService):
 *   attempts: 3, backoff: exponential 30s → 30s / 60s / 120s (FR-009).
 *   removeOnFail: false — failed jobs stay in the set for inspection (FR-010).
 *
 * On permanent failure (all attempts exhausted): marks notification as `failed`
 * and logs structured entry with correlationId (FR-011).
 */
@Injectable()
export class NotificationsWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationsWorker.name);
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly channelRouter: ChannelRouter,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.worker = this.bullMqService.createWorker(
      NOTIFICATIONS_QUEUE_NAME,
      async (job: Job<NotificationJobPayload>) => this.process(job),
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        {
          jobId: job?.id,
          notificationId: job?.data?.notificationId,
          correlationId: job?.data?.correlationId,
          channel: job?.data?.channel,
          error: err.message,
        },
        'notification job permanently failed',
      );

      // Best-effort: mark notification as failed in the DB
      if (job?.data) {
        const { tenantId, userId, notificationId, correlationId } = job.data;
        requestContext
          .run(
            { tenantId, userId, requestId: generateId(), correlationId },
            () => this.notificationsService.updateStatus(notificationId, 'failed'),
          )
          .catch((e) =>
            this.logger.error(
              { error: (e as Error).message, notificationId },
              'failed to mark notification as failed',
            ),
          );
      }
    });

    this.logger.log('notifications worker started');
  }

  private async process(job: Job<NotificationJobPayload>): Promise<void> {
    const { tenantId, userId, notificationId, channel, correlationId } = job.data;

    await requestContext.run(
      { tenantId, userId, requestId: generateId(), correlationId },
      async () => {
        const channelImpl = this.channelRouter.route(channel);

        // Build a minimal payload — InAppChannel reads the actual title/body
        // from the DB if needed; EmailChannel stub does not need them.
        const result = await channelImpl.send({
          notificationId,
          tenantId,
          userId,
          channel: channel as NotificationJobPayload['channel'],
          type: 'system', // actual type is fetched from DB by channel impl if needed
          title: '',
          body: '',
        });

        if (!result.success) {
          // Re-throw so BullMQ counts the attempt and applies backoff
          throw new Error(result.error ?? `Channel ${channel} send failed`);
        }

        this.logger.log(
          { notificationId, channel, correlationId, jobId: job.id },
          'notification delivered',
        );
      },
    );
  }
}
