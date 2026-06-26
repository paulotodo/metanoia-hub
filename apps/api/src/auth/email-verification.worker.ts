import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { BullMqService } from '../bullmq/bullmq.service';
import type { EnvConfig } from '../config/env.validation';
import { EmailService } from '../notifications/channels/email.service';
import { renderEmailVerification } from '../notifications/templates/email-verification.template';

const EMAIL_VERIFICATION_QUEUE = 'email-verification';

interface EmailVerificationJobData {
  email: string;
  firstName: string;
  token: string;
}

@Injectable()
export class EmailVerificationWorker implements OnModuleInit {
  private readonly logger = new Logger(EmailVerificationWorker.name);

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly emailService: EmailService,
  ) {}

  onModuleInit() {
    const worker = this.bullMqService.createWorker(
      EMAIL_VERIFICATION_QUEUE,
      async (job: Job<EmailVerificationJobData>) => this.process(job),
    );

    worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'email verification job failed',
      );
    });

    this.logger.log('email verification worker started');
  }

  private async process(job: Job<EmailVerificationJobData>): Promise<void> {
    const { email, firstName, token } = job.data;

    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    const verifyUrl = `${frontendUrl}/confirmar-email/${token}`;

    const { subject, html } = renderEmailVerification({ firstName, verifyUrl });
    const result = await this.emailService.send({ to: email, subject, html });

    if (!result.success) {
      if (result.retryable) {
        // Throw so BullMQ retries (attempts: 3, exponential backoff).
        throw new Error(
          `verification email send failed (retryable): ${result.error}`,
        );
      }
      // Permanent failure (4xx) — log and swallow so the job doesn't loop.
      this.logger.warn(
        { email, error: result.error },
        'verification email permanently failed',
      );
      return;
    }

    this.logger.log(
      { email, providerId: result.providerId },
      'verification email sent',
    );
  }
}
