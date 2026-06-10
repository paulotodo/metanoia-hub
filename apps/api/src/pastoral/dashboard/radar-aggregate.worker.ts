import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Worker } from 'bullmq';
import {
  RADAR_AGGREGATE_QUEUE_NAME,
  RADAR_AGGREGATE_CACHE_KEY_PREFIX,
  RADAR_AGGREGATE_CACHE_TTL_SECONDS,
} from '@metanoia/types';
import { generateId } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { RedisService } from '../../redis/redis.service';
import { requestContext } from '../../common/context/request-context';
import { RadarDashboardRepository } from './radar-dashboard.repository';

export interface RadarAggregateJobData {
  tenantId: string;
  triggeredAt: string;
}

@Injectable()
export class RadarAggregateWorker implements OnModuleInit {
  private readonly logger = new Logger(RadarAggregateWorker.name);
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly redisService: RedisService,
    private readonly repository: RadarDashboardRepository,
  ) {}

  onModuleInit() {
    this.worker = this.bullMqService.createWorker(
      RADAR_AGGREGATE_QUEUE_NAME,
      async (job: Job<RadarAggregateJobData>) => this.process(job),
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'radar aggregate job failed',
      );
    });

    this.logger.log('radar aggregate worker started');
  }

  private async process(job: Job<RadarAggregateJobData>): Promise<void> {
    const { tenantId, triggeredAt } = job.data;

    await requestContext.run(
      {
        tenantId,
        userId: 'system',
        requestId: generateId(),
        correlationId: `radar-agg-${job.id ?? 'unknown'}`,
      },
      async () => {
        try {
          const rows = await this.repository.aggregateByTenant();

          let verde = 0, amarelo = 0, vermelho = 0;
          for (const r of rows) {
            verde += r.verde;
            amarelo += r.amarelo;
            vermelho += r.vermelho;
          }

          const distribution = {
            verde,
            amarelo,
            vermelho,
            total: verde + amarelo + vermelho,
          };

          const redRatio = distribution.total > 0 ? distribution.vermelho / distribution.total : 0;
          const greenRatio = distribution.total > 0 ? distribution.verde / distribution.total : 0;
          const trend =
            redRatio > 0.4 ? 'piora' : greenRatio > 0.6 ? 'melhora' : 'estavel';

          const payload = JSON.stringify({
            distribution,
            byGroup: rows,
            trend,
            calculatedAt: new Date().toISOString(),
          });

          const cacheKey = `${RADAR_AGGREGATE_CACHE_KEY_PREFIX}:${tenantId}`;
          await this.redisService.set(
            cacheKey,
            payload,
            'EX',
            RADAR_AGGREGATE_CACHE_TTL_SECONDS,
          );

          this.logger.log(
            {
              tenantId,
              groupCount: rows.length,
              triggeredAt,
              jobId: job.id,
            },
            'radar aggregate cached',
          );
        } catch (error) {
          this.logger.error(
            { tenantId, jobId: job.id, error: (error as Error).message },
            'radar aggregate failed',
          );
          throw error;
        }
      },
    );
  }
}
