/**
 * PrivacyDeletionProcessor — BullMQ worker for deletion jobs (Story 9-2).
 *
 * Privileged context: does NOT use RequestContext (no HTTP request).
 * Handles two job names: 'soft-delete-user-data' / 'hard-delete-user-data'.
 * Backoff: exponential 60s/300s/1800s (AVS-03/CHK021).
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PRIVACY_DELETION_QUEUE_NAME, type PrivacyDeletionJobPayload } from '@metanoia/types';
import { BullMqService } from '../bullmq/bullmq.service';
import { PrivacyDeletionService } from './privacy-deletion.service';

@Injectable()
export class PrivacyDeletionProcessor implements OnModuleInit {
  private readonly logger = new Logger(PrivacyDeletionProcessor.name);

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly privacyDeletionService: PrivacyDeletionService,
  ) {}

  onModuleInit(): void {
    this.bullMqService.createWorker(PRIVACY_DELETION_QUEUE_NAME, async (job) => {
      this.logger.log({ jobId: job.id, name: job.name }, 'processing privacy deletion job');

      const payload = job.data as PrivacyDeletionJobPayload;

      if (job.name === 'soft-delete-user-data') {
        try {
          await this.privacyDeletionService.softDeleteAllTenants(payload);
        } catch (error) {
          this.logger.error(
            { jobId: payload.requestId, error },
            'privacy soft-delete job failed',
          );
          await this.privacyDeletionService.handleJobFailure(
            payload.requestId,
            error instanceof Error ? error.message : String(error),
          );
          throw error; // re-throw so BullMQ applies backoff/retry
        }
        return;
      }

      if (job.name === 'hard-delete-user-data') {
        try {
          await this.privacyDeletionService.hardDeleteAllTenants(payload);
        } catch (error) {
          this.logger.error(
            { jobId: payload.requestId, error },
            'privacy hard-delete job failed',
          );
          await this.privacyDeletionService.handleJobFailure(
            payload.requestId,
            error instanceof Error ? error.message : String(error),
          );
          throw error; // re-throw so BullMQ applies backoff/retry
        }
        return;
      }

      this.logger.warn({ jobId: job.id, name: job.name }, 'unknown job name — skipping');
    });

    this.logger.log('privacy deletion worker initialized');
  }
}
