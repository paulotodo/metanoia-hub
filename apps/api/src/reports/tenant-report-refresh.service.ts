import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { generateId, REPORTS_QUEUE_NAME, type TenantRefreshResponse } from '@metanoia/types';
import { BullMqService } from '../bullmq/bullmq.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { getRequestContext } from '../common/context/request-context';

const RATE_KEY_PREFIX = 'rate:tenant-report-refresh';
const RATE_LIMIT_TTL_S = 300;

@Injectable()
export class TenantReportRefreshService implements OnModuleInit {
  private readonly logger = new Logger(TenantReportRefreshService.name);
  private queue!: Queue;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.queue = this.bullMqService.createQueue(REPORTS_QUEUE_NAME);
  }

  async requestRefresh(): Promise<{ status: 202 | 429; body: TenantRefreshResponse }> {
    const { tenantId } = getRequestContext();

    const rateKey = `${RATE_KEY_PREFIX}:${tenantId}`;

    // Rate-limit atômico via SET NX EX — não GET-then-SET (AC-SEC-05)
    const set = await this.redis.set(rateKey, '1', 'EX', RATE_LIMIT_TTL_S, 'NX');

    if (set === null) {
      const pttl = await this.redis.pttl(rateKey);
      const retryAfterSec = pttl > 0 ? Math.ceil(pttl / 1_000) : RATE_LIMIT_TTL_S;
      this.logger.warn({ tenantId, retryAfterSec }, 'refresh rate-limited');
      return {
        status: 429,
        body: { data: { accepted: false, jobId: null }, meta: { retryAfter: retryAfterSec } },
      };
    }

    const jobId = generateId();
    await this.queue.add('refresh-tenant-views', {}, { jobId });

    await this.prisma.client.mvRefreshLog.create({
      data: {
        id: generateId(),
        mvName: 'mv_tenant_report',
        durationMs: 0,
        status: 'queued',
        tenantId,
      },
    });

    this.logger.log({ tenantId, jobId }, 'refresh enqueued on-demand');
    return {
      status: 202,
      body: { data: { accepted: true, jobId }, meta: { retryAfter: null } },
    };
  }
}
