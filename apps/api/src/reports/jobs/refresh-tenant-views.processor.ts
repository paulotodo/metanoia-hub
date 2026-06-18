import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue, Worker } from 'bullmq';
import { generateId, REPORTS_QUEUE_NAME } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { PrismaService } from '../../prisma/prisma.service';

const JOB_NAME = 'refresh-tenant-views';
const JOB_ID = 'refresh-tenant-views-scheduler';
const TIMEOUT_MS = 10 * 60 * 1_000;
const SLOW_THRESHOLD_MS = 5 * 60 * 1_000;
@Injectable()
export class RefreshTenantViewsProcessor implements OnModuleInit {
  private readonly logger = new Logger(RefreshTenantViewsProcessor.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queue = this.bullMqService.createQueue(REPORTS_QUEUE_NAME);

    this.worker = this.bullMqService.createWorker(
      REPORTS_QUEUE_NAME,
      async (job: Job) => this.dispatch(job),
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, name: job?.name, attempts: job?.attemptsMade, error: err.message },
        'mv_refresh_failed',
      );
    });

    await this.queue.add(
      JOB_NAME,
      {},
      {
        repeat: { pattern: '*/15 * * * *' },
        jobId: JOB_ID,
        attempts: 3,
        // Exponencial base 30s -> 30s / 60s / 120s (escalonado, conforme tasks.md)
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
    this.logger.log('refresh-tenant-views scheduler started (cron: */15 * * * *)');
  }

  private async dispatch(job: Job): Promise<void> {
    if (job.name === JOB_NAME) {
      await this.processRefresh(job);
    }
  }

  private async processRefresh(_job: Job): Promise<void> {
    const correlationId = generateId();
    const startedAt = Date.now();

    this.logger.log({ correlationId }, 'mv refresh started');

    const refreshPromise = this.prisma.client.$executeRaw`
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_report
    `;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('mv refresh timeout (10min)')), TIMEOUT_MS),
    );

    try {
      await Promise.race([refreshPromise, timeoutPromise]);
      const durationMs = Date.now() - startedAt;

      if (durationMs > SLOW_THRESHOLD_MS) {
        this.logger.warn({ correlationId, durationMs }, 'mv_refresh_slow');
      } else {
        this.logger.log({ correlationId, durationMs }, 'mv refresh completed');
      }

      await this.prisma.client.mvRefreshLog.create({
        data: {
          id: generateId(),
          mvName: 'mv_tenant_report',
          durationMs,
          status: 'success',
          tenantId: null,
        },
      });
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      this.logger.error({ correlationId, durationMs, error: (err as Error).message }, 'mv_refresh_failed');

      await this.prisma.client.mvRefreshLog.create({
        data: {
          id: generateId(),
          mvName: 'mv_tenant_report',
          durationMs,
          status: 'failed',
          tenantId: null,
        },
      });

      throw err;
    }
  }
}
