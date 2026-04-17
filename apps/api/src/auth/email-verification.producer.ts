import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BullMqService } from '../bullmq/bullmq.service';

const EMAIL_VERIFICATION_QUEUE = 'email-verification';

interface EmailVerificationJobData {
  userId: string;
  email: string;
}

@Injectable()
export class EmailVerificationProducer implements OnModuleInit {
  private readonly logger = new Logger(EmailVerificationProducer.name);
  private queue!: Queue;

  constructor(private readonly bullMqService: BullMqService) {}

  onModuleInit() {
    this.queue = this.bullMqService.createQueue(EMAIL_VERIFICATION_QUEUE);
    this.logger.log('email verification queue initialized');
  }

  async enqueue(data: EmailVerificationJobData): Promise<void> {
    await this.queue.add('send-verification', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    this.logger.log({ userId: data.userId, email: data.email }, 'verification email job enqueued');
  }
}
