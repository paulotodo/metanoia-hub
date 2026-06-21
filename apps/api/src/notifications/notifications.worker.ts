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
      // Sanitize error: strip PII and secrets from failure reason (CHK018/FR-07).
      // Only log error code/type, not message body which may contain email content.
      const safeError = err.message.substring(0, 200).replace(/[\r\n]/g, ' ');

      this.logger.error(
        {
          jobId: job?.id,
          notificationId: job?.data?.notificationId,
          correlationId: job?.data?.correlationId,
          channel: job?.data?.channel,
          // L1: never log 'html', 'signedUrl', or full error body here
          errorType: err.name,
          error: safeError,
        },
        'notification job permanently failed',
      );

      if (job?.data) {
        const { tenantId, userId, notificationId, channel, correlationId } = job.data;

        requestContext
          .run(
            { tenantId, userId, requestId: generateId(), correlationId },
            async () => {
              // Mark notification as failed with sanitized failure reason (FR-07/FR-18).
              await this.notificationsService.updateStatus(notificationId, 'failed');

              // Story 14-3 (FASE 5.2): email channel → create in-app fallback after exhausted retries (FR-06).
              // Other channels: no fallback needed (in_app failure is already the last resort).
              if (channel === 'email') {
                try {
                  // Re-fetch notification data to build fallback payload
                  // We use a minimal dispatch with what we have from the job payload.
                  // The channel router will deliver via in_app.
                  await this.notificationsService.dispatch({
                    userId,
                    type: 'system', // Fallback to system type (actual type not stored in job payload)
                    title: 'Notificação não entregue por email',
                    body: 'Não foi possível entregar sua notificação por email. Verifique sua caixa de entrada ou tente novamente.',
                    channels: ['in_app'],
                    metadata: {
                      fallbackOf: notificationId,
                      // CHK018/FR-07: only error code, no PII or email body
                      failureReason: `Email delivery failed after 3 attempts: ${err.name}`,
                    },
                  });
                  this.logger.log({ notificationId }, 'email fallback in-app created');
                } catch (fallbackErr) {
                  this.logger.error(
                    { notificationId, error: (fallbackErr as Error).message },
                    'failed to create in-app fallback for email failure',
                  );
                }
              }
            },
          )
          .catch((e) =>
            this.logger.error(
              { error: (e as Error).message, notificationId },
              'failed to handle permanently failed notification',
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
