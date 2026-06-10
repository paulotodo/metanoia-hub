import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { RADAR_AGGREGATE_QUEUE_NAME } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import type { RadarAggregateJobData } from './radar-aggregate.worker';

@Injectable()
export class RadarAggregateJobService implements OnModuleInit {
  private readonly logger = new Logger(RadarAggregateJobService.name);
  private queue!: Queue;

  constructor(private readonly bullMqService: BullMqService) {}

  onModuleInit() {
    this.queue = this.bullMqService.createQueue(RADAR_AGGREGATE_QUEUE_NAME);
    this.logger.log('radar aggregate queue initialized');
  }

  /**
   * Enqueues a radar aggregate job for a tenant.
   * Uses jobId deduplication to avoid thundering herd.
   */
  async enqueueAggregation(tenantId: string): Promise<void> {
    const payload: RadarAggregateJobData = {
      tenantId,
      triggeredAt: new Date().toISOString(),
    };

    await this.queue.add('aggregate', payload, {
      jobId: `radar-agg:${tenantId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.log({ tenantId }, 'radar aggregate job enqueued');
  }
}
