import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Worker } from 'bullmq';
import { generateId, RADAR_QUEUE_NAME } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { RedisService } from '../../redis/redis.service';
import { requestContext } from '../../common/context/request-context';
import { RadarCalculatorService } from './radar-calculator.service';
import { RADAR_CACHE_TTL_SECONDS, RADAR_CACHE_KEY_PREFIX } from '@metanoia/types';

export interface RadarJobData {
  tenantId: string;
  groupId: string;
  triggeredAt: string;
}

@Injectable()
export class RadarCalculationWorker implements OnModuleInit {
  private readonly logger = new Logger(RadarCalculationWorker.name);
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly redisService: RedisService,
    private readonly calculatorService: RadarCalculatorService,
  ) {}

  onModuleInit() {
    this.worker = this.bullMqService.createWorker(
      RADAR_QUEUE_NAME,
      async (job: Job<RadarJobData>) => this.process(job),
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'radar calculation job failed',
      );
    });

    this.logger.log('radar calculation worker started');
  }

  private async process(job: Job<RadarJobData>): Promise<void> {
    const { tenantId, groupId, triggeredAt } = job.data;

    // Worker runs outside HTTP lifecycle — manually set RequestContext for RLS
    await requestContext.run(
      {
        tenantId,
        userId: 'system',
        requestId: generateId(),
        correlationId: `radar-job-${job.id ?? 'unknown'}`,
      },
      async () => {
        try {
          const result = await this.calculatorService.recalculate(tenantId, groupId);

          // Cache results in Redis: cache:radar:{tenantId}:{groupId}
          const cacheKey = `${RADAR_CACHE_KEY_PREFIX}:${tenantId}:${groupId}`;
          await this.redisService.set(
            cacheKey,
            JSON.stringify(result.participants),
            'EX',
            RADAR_CACHE_TTL_SECONDS,
          );

          this.logger.log(
            {
              tenantId,
              groupId,
              participantCount: result.participants.length,
              triggeredAt,
              jobId: job.id,
            },
            'radar calculation cached',
          );
        } catch (error) {
          this.logger.error(
            { tenantId, groupId, jobId: job.id, error: (error as Error).message },
            'radar calculation failed',
          );
          throw error; // Re-throw so BullMQ retries
        }
      },
    );
  }
}
