import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Worker } from 'bullmq';
import { BullMqService } from '../bullmq/bullmq.service';

const EMAIL_VERIFICATION_QUEUE = 'queue:email-verification';

interface EmailVerificationJobData {
  userId: string;
  email: string;
}

@Injectable()
export class EmailVerificationWorker implements OnModuleInit {
  private readonly logger = new Logger(EmailVerificationWorker.name);
  private worker!: Worker;

  constructor(private readonly bullMqService: BullMqService) {}

  onModuleInit() {
    this.worker = this.bullMqService.createWorker(
      EMAIL_VERIFICATION_QUEUE,
      async (job: Job<EmailVerificationJobData>) => this.process(job),
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'email verification job failed',
      );
    });

    this.logger.log('email verification worker started');
  }

  private async process(job: Job<EmailVerificationJobData>): Promise<void> {
    const { userId, email } = job.data;

    // DEV STUB: log instead of sending actual email
    this.logger.log(
      { userId, email, jobId: job.id },
      'EMAIL VERIFICATION STUB: would send verification email',
    );
  }
}
