import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { RADAR_QUEUE_NAME } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import type { RadarJobData } from './radar-calculation.worker';

@Injectable()
export class RadarJobService implements OnModuleInit {
  private readonly logger = new Logger(RadarJobService.name);
  private queue!: Queue;

  constructor(private readonly bullMqService: BullMqService) {}

  onModuleInit() {
    this.queue = this.bullMqService.createQueue(RADAR_QUEUE_NAME);
    this.logger.log('radar job queue initialized');
  }

  /**
   * Enqueues a radar recalculation job for a specific group.
   * Idempotent: recalculating is safe to call multiple times.
   */
  async enqueueRadarCalculation(tenantId: string, groupId: string): Promise<void> {
    const payload: RadarJobData = {
      tenantId,
      groupId,
      triggeredAt: new Date().toISOString(),
    };

    await this.queue.add('recalculate', payload, {
      // Deduplicate by group within a short window (avoid thundering herd)
      jobId: `radar:${tenantId}:${groupId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.log({ tenantId, groupId }, 'radar calculation job enqueued');
  }
}
