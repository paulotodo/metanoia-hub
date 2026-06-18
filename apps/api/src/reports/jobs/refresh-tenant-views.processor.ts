import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Job, Queue, Worker } from 'bullmq';
import { generateId, REPORTS_QUEUE_NAME } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { EnvConfig } from '../../config/env.validation';

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
    private readonly configService: ConfigService<EnvConfig, true>,
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

  /**
   * Build a dedicated PRIVILEGED Prisma client (DATABASE_URL, role `metanoia`
   * superuser). REFRESH MATERIALIZED VIEW [CONCURRENTLY] requires the caller to
   * be OWNER of the MV and to see ALL tenants. The application role
   * (`metanoia_app`, NOSUPERUSER) is neither the owner nor RLS-bypassing
   * (FORCE ROW LEVEL SECURITY on base tables), so the refresh must run here.
   */
  private createPrivilegedClient(): PrismaClient {
    const connectionString = this.configService.get('DATABASE_URL', { infer: true });
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  }

  private async processRefresh(_job: Job): Promise<void> {
    const correlationId = generateId();
    const startedAt = Date.now();

    this.logger.log({ correlationId }, 'mv refresh started');

    // Privileged connection: owner of the MV + bypasses RLS (all tenants).
    const privileged = this.createPrivilegedClient();

    try {
      // CONCURRENTLY cannot run inside a transaction — issue the statement
      // directly on the privileged client (never via $transaction).
      const refreshPromise = privileged.$executeRawUnsafe(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_report',
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('mv refresh timeout (10min)')), TIMEOUT_MS),
      );

      await Promise.race([refreshPromise, timeoutPromise]);
      const durationMs = Date.now() - startedAt;

      if (durationMs > SLOW_THRESHOLD_MS) {
        this.logger.warn({ correlationId, durationMs }, 'mv_refresh_slow');
      } else {
        this.logger.log({ correlationId, durationMs }, 'mv refresh completed');
      }

      // Log write stays on the app client — the mv_refresh_log RLS policy
      // permits tenant_id IS NULL inserts, which is what the job writes.
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
    } finally {
      // Always release the privileged connection — never leak it.
      await privileged.$disconnect();
    }
  }
}
