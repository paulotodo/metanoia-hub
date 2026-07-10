import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { BullMqService } from '../bullmq/bullmq.service';
import type { EnvConfig } from '../config/env.validation';
import { EmailService } from '../notifications/channels/email.service';
import { renderPasswordRecovery } from '../notifications/templates/password-recovery.template';

const RECOVERY_EMAIL_QUEUE = 'email-recovery';

interface RecoveryEmailJobData {
  email: string;
  firstName: string;
  token: string;
}

@Injectable()
export class RecoveryEmailWorker implements OnModuleInit {
  private readonly logger = new Logger(RecoveryEmailWorker.name);

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    const worker = this.bullMqService.createWorker(
      RECOVERY_EMAIL_QUEUE,
      async (job: Job<RecoveryEmailJobData>) => this.processJob(job.data),
    );

    worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'recovery email job failed',
      );
    });

    this.logger.log('recovery email worker started');
  }

  private async processJob(data: RecoveryEmailJobData): Promise<void> {
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    const resetUrl = `${frontendUrl}/nova-senha/${data.token}`;

    const { subject, html } = renderPasswordRecovery({
      firstName: data.firstName,
      resetUrl,
    });
    const result = await this.emailService.send({
      to: data.email,
      subject,
      html,
    });

    if (!result.success) {
      if (result.retryable) {
        // Throw so BullMQ retries (attempts: 3, exponential backoff).
        throw new Error(
          `recovery email send failed (retryable): ${result.error}`,
        );
      }
      // Permanent failure (4xx) — log and swallow so the job doesn't loop.
      this.logger.warn(
        { email: data.email, error: result.error },
        'recovery email permanently failed',
      );
      return;
    }

    this.logger.log(
      { email: data.email, providerId: result.providerId },
      'recovery email sent',
    );
  }
}
