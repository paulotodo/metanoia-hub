import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { FlowProducer, Job, Queue, Worker } from 'bullmq';
import { generateId, REPORTS_QUEUE_NAME } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import type { EnvConfig } from '../../config/env.validation';

/**
 * INF-02: Refresh da mv_platform_metrics agendado apos mv_tenant_report.
 *
 * Estrategia: cron independente a cada 30 min (offset do tenant refresh que
 * roda em cada 15 min). O FlowProducer e usado para encadear um child job do
 * tenant-refresh antes do parent platform-refresh em cada execucao manual.
 * Para o agendamento cron regular, usa queue.add com repeat (FlowJob nao
 * suporta repeat — limitacao do BullMQ).
 */
const PARENT_JOB_NAME = 'refresh-platform-views';
const PARENT_JOB_ID = 'refresh-platform-views-scheduler';
const TIMEOUT_MS = 5 * 60 * 1_000;
const SLOW_THRESHOLD_MS = 2 * 60 * 1_000;

@Injectable()
export class RefreshPlatformViewsProcessor implements OnModuleInit {
  private readonly logger = new Logger(RefreshPlatformViewsProcessor.name);
  private queue!: Queue;
  private flowProducer!: FlowProducer;
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    // INF-02: FlowProducer disponivel para encadeamento manual (ex: trigger via endpoint)
    this.flowProducer = this.bullMqService.createFlowProducer();
    this.queue = this.bullMqService.createQueue(REPORTS_QUEUE_NAME);

    this.worker = this.bullMqService.createWorker(
      REPORTS_QUEUE_NAME,
      async (job: Job) => this.dispatch(job),
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, name: job?.name, attempts: job?.attemptsMade, error: err.message },
        'platform_mv_refresh_failed',
      );
    });

    // Agenda cron a cada 30 min (offset de 15 min do tenant refresh)
    // Nota: FlowJob nao suporta opts.repeat — usa queue.add diretamente (INF-02 trade-off)
    await this.queue.add(
      PARENT_JOB_NAME,
      {},
      {
        repeat: { pattern: '*/30 * * * *' },
        jobId: PARENT_JOB_ID,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
    this.logger.log('refresh-platform-views scheduler started (cron: */30 * * * *)');
  }

  /**
   * Trigger manual via FlowProducer (INF-02 arvore invertida).
   * child: refresh-tenant-views -> parent: refresh-platform-views
   */
  async triggerFlow(): Promise<string> {
    const correlationId = generateId();
    await this.flowProducer.add({
      name: PARENT_JOB_NAME,
      queueName: REPORTS_QUEUE_NAME,
      opts: {
        attempts: 1,
        jobId: `manual-platform-flow-${correlationId}`,
      },
      children: [
        {
          name: 'refresh-tenant-views',
          queueName: REPORTS_QUEUE_NAME,
          opts: { attempts: 1 },
        },
      ],
    });
    return correlationId;
  }

  private async dispatch(job: Job): Promise<void> {
    if (job.name === PARENT_JOB_NAME) {
      await this.processRefresh(job);
    }
  }

  /**
   * Build a dedicated PRIVILEGED Prisma client (DATABASE_URL, role metanoia
   * superuser). REFRESH MATERIALIZED VIEW CONCURRENTLY requires the caller to
   * be OWNER of the MV and to see ALL tenants.
   */
  private createPrivilegedClient(): PrismaClient {
    const connectionString = this.configService.get('DATABASE_URL', { infer: true });
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  }

  private async processRefresh(_job: Job): Promise<void> {
    const correlationId = generateId();
    const startedAt = Date.now();

    this.logger.log({ correlationId }, 'platform mv refresh started');

    const privileged = this.createPrivilegedClient();
    try {
      await privileged.$connect();
      // REFRESH CONCURRENTLY requires the UNIQUE INDEX on mv_platform_metrics (INF-01)
      await privileged.$executeRawUnsafe(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_metrics',
      );

      const durationMs = Date.now() - startedAt;
      const level = durationMs > SLOW_THRESHOLD_MS ? 'warn' : 'log';
      this.logger[level](
        { correlationId, durationMs },
        'platform mv refresh completed',
      );

      if (durationMs > TIMEOUT_MS) {
        this.logger.error(
          { correlationId, durationMs },
          'platform mv refresh exceeded timeout threshold',
        );
      }
    } finally {
      await privileged.$disconnect();
    }
  }
}
