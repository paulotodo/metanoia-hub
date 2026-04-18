import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BullMqService } from '../bullmq/bullmq.service';

const RECOVERY_EMAIL_QUEUE = 'email-recovery';

interface RecoveryEmailJobData {
  email: string;
  firstName: string;
  token: string;
}

@Injectable()
export class RecoveryEmailProducer implements OnModuleInit {
  private readonly logger = new Logger(RecoveryEmailProducer.name);
  private queue!: Queue;

  constructor(private readonly bullMqService: BullMqService) {}

  onModuleInit() {
    this.queue = this.bullMqService.createQueue(RECOVERY_EMAIL_QUEUE);
    this.logger.log('recovery email queue initialized');
  }

  async enqueue(data: RecoveryEmailJobData): Promise<void> {
    await this.queue.add('send-recovery', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    this.logger.log(
      { email: data.email, firstName: data.firstName },
      'recovery email job enqueued',
    );
  }
}
