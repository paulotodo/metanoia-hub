import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { BullMqService } from '../bullmq/bullmq.service';
import type { EnvConfig } from '../config/env.validation';

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
  ) {}

  onModuleInit() {
    this.bullMqService.createWorker(
      RECOVERY_EMAIL_QUEUE,
      async (job: Job<RecoveryEmailJobData>) => {
        await this.processJob(job.data);
      },
    );
    this.logger.log('recovery email worker started');
  }

  private async processJob(data: RecoveryEmailJobData): Promise<void> {
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    const resetLink = `${frontendUrl}/nova-senha/${data.token}`;

    // TODO: Replace with actual email transport (SendGrid/Resend) when SMTP is configured
    this.logger.log(
      {
        to: data.email,
        firstName: data.firstName,
        resetLink,
        subject: `${data.firstName}, aqui tá o link pra sua senha nova`,
      },
      'recovery email sent (placeholder)',
    );
  }
}
