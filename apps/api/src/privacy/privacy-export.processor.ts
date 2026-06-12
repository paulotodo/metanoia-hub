/**
 * PrivacyExportProcessor — BullMQ worker for data export jobs.
 *
 * Privileged context: does NOT use RequestContext (no HTTP request).
 * Backoff: exponential 60s/300s/1800s (dec-020/CHK021).
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PRIVACY_EXPORT_QUEUE_NAME, type PrivacyExportJobPayload } from '@metanoia/types';
import { BullMqService } from '../bullmq/bullmq.service';
import { PrivacyExportService } from './privacy-export.service';

@Injectable()
export class PrivacyExportProcessor implements OnModuleInit {
  private readonly logger = new Logger(PrivacyExportProcessor.name);

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly privacyExportService: PrivacyExportService,
  ) {}

  onModuleInit(): void {
    this.bullMqService.createWorker(PRIVACY_EXPORT_QUEUE_NAME, async (job) => {
      this.logger.log({ jobId: job.id, name: job.name }, 'processing privacy export job');

      if (job.name === 'export-personal-data') {
        const payload = job.data as PrivacyExportJobPayload;
        try {
          await this.privacyExportService.processExportJob(payload);
        } catch (error) {
          // BullMQ will retry per the backoff policy (3 attempts).
          // On final failure (after all retries), handleJobFailure is called by the processor.
          this.logger.error({ jobId: payload.jobId, error }, 'privacy export job failed');
          await this.privacyExportService.handleJobFailure(
            payload.jobId,
            error instanceof Error ? error.message : String(error),
          );
          throw error; // re-throw so BullMQ applies backoff/retry
        }
      }
    });

    this.logger.log('privacy export worker initialized');
  }
}
