import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Job, Queue, Worker } from 'bullmq';
import { generateId, REPORTS_QUEUE_NAME } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { requestContext } from '../../common/context/request-context';
import { EvasionDetectionService } from '../../pastoral/evasion-detection.service';
import type { EnvConfig } from '../../config/env.validation';

const JOB_NAME = 'detect-evasion-risk';
const JOB_SCHEDULER_ID = 'detect-evasion-risk-scheduler';
const BATCH_SIZE = 100;
const JOB_SLA_MS = 30 * 60 * 1_000; // 30 min SLA
const MAX_CONSECUTIVE_FAILURES = 3;

interface ActiveTenant {
  id: string;
}

interface GroupMemberPair {
  user_id: string;
  group_id: string;
}

@Injectable()
export class DetectEvasionRiskProcessor implements OnModuleInit {
  private readonly logger = new Logger(DetectEvasionRiskProcessor.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly evasionDetectionService: EvasionDetectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queue = this.bullMqService.createQueue(REPORTS_QUEUE_NAME);

    this.worker = this.bullMqService.createWorker(
      REPORTS_QUEUE_NAME,
      async (job: Job) => this.dispatch(job),
    );

    this.worker.on('failed', (job, err) => {
      if ((job?.attemptsMade ?? 0) >= MAX_CONSECUTIVE_FAILURES) {
        this.logger.error(
          {
            jobId: job?.id,
            name: job?.name,
            attempts: job?.attemptsMade,
            error: err.message,
          },
          'detect_evasion_risk_failed_max_attempts',
        );
        // Insert failed log (best-effort, fire-and-forget)
        void this.insertJobLog({
          jobRunId: generateId(),
          status: 'failed',
          durationMs: null,
          tenantsProcessed: 0,
          participantsFlagged: 0,
          errorMessage: err.message,
        });
      }
    });

    await this.queue.upsertJobScheduler(
      JOB_SCHEDULER_ID,
      { pattern: '0 6 * * *' }, // 06:00 UTC daily
      {
        name: JOB_NAME,
        opts: {
          attempts: MAX_CONSECUTIVE_FAILURES,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      },
    );
    this.logger.log('detect-evasion-risk scheduler started (cron: 0 6 * * *)');
  }

  private async dispatch(job: Job): Promise<void> {
    if (job.name === JOB_NAME) {
      await this.processDetection(job);
    }
  }

  /**
   * Privileged client for listing all active tenants (bypass RLS).
   * Same pattern as refresh-tenant-views.processor.ts (confirmed probe 13-2b).
   */
  private createPrivilegedClient(): PrismaClient {
    const connectionString = this.configService.get('DATABASE_URL', { infer: true });
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  }

  private async processDetection(_job: Job): Promise<void> {
    const correlationId = generateId(); // 1 UUID per job run (CHK030-RES)
    const startedAt = Date.now();

    this.logger.log({ correlationId }, 'detect_evasion_risk_started');

    // Step 1: List active tenants via privileged client (AC-SEC-01)
    const privileged = this.createPrivilegedClient();
    let activeTenantIds: string[] = [];

    try {
      const tenants = await privileged.$queryRawUnsafe<ActiveTenant[]>(
        `SELECT id::text FROM tenants WHERE status = 'active'`,
      );
      activeTenantIds = tenants.map((t) => t.id);
    } finally {
      // CRITICAL: disconnect privileged client BEFORE the loop (AC-SEC-01)
      await privileged.$disconnect();
    }

    this.logger.log(
      { correlationId, tenantCount: activeTenantIds.length },
      'detect_evasion_tenants_fetched',
    );

    let tenantsProcessed = 0;
    let participantsFlagged = 0;
    const tenantErrors: string[] = [];

    // Step 2: Process each tenant in isolation
    for (const tenantId of activeTenantIds) {
      try {
        const flagged = await requestContext.run(
          {
            tenantId,
            userId: 'system',
            requestId: correlationId,
            correlationId,
          },
          async () => {
            return this.processForTenant(tenantId, correlationId);
          },
        );
        participantsFlagged += flagged;
        tenantsProcessed++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        tenantErrors.push(`${tenantId}: ${errorMsg}`);
        this.logger.error(
          { tenantId, correlationId, error: errorMsg },
          'detect_evasion_tenant_failed',
        );
        // Skip + continue — one tenant failure does not abort others
      }
    }

    const durationMs = Date.now() - startedAt;

    if (durationMs > JOB_SLA_MS) {
      this.logger.warn(
        { correlationId, durationMs, slaMs: JOB_SLA_MS },
        'detect_evasion_risk_sla_exceeded',
      );
    }

    this.logger.log(
      {
        correlationId,
        durationMs,
        tenantsProcessed,
        participantsFlagged,
        tenantErrors: tenantErrors.length,
      },
      'detect_evasion_risk_completed',
    );

    // Step 3: Persist job log (global entry, tenant_id = null)
    await this.insertJobLog({
      jobRunId: correlationId,
      status: tenantErrors.length === 0 ? 'success' : 'partial',
      durationMs,
      tenantsProcessed,
      participantsFlagged,
      errorMessage:
        tenantErrors.length > 0 ? tenantErrors.slice(0, 3).join('; ') : null,
    });
  }

  private async processForTenant(
    tenantId: string,
    correlationId: string,
  ): Promise<number> {
    let flaggedCount = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch of participant-group pairs for this tenant (RLS enforced via RequestContext)
      const pairs = await withTenantTx(
        this.prisma,
        async (tx) => {
          return tx.$queryRawUnsafe<GroupMemberPair[]>(
            `SELECT gm.user_id::text, gm.group_id::text
             FROM group_members gm
             JOIN groups g ON g.id = gm.group_id
             WHERE gm.deleted_at IS NULL
               AND g.status = 'active'
             ORDER BY gm.user_id, gm.group_id
             LIMIT $1`,
            BATCH_SIZE,
          );
        },
        { tenantId },
      );

      // Stop when batch is smaller than BATCH_SIZE (last page or empty)
      hasMore = pairs.length === BATCH_SIZE;

      for (const pair of pairs) {
        try {
          const result = await this.evasionDetectionService.evaluateParticipant(
            pair.user_id,
            pair.group_id,
            { tenantId },
          );
          if (result.action === 'flagged') {
            flaggedCount++;
          }
        } catch (participantErr) {
          this.logger.warn(
            {
              tenantId,
              correlationId,
              participantId: pair.user_id,
              groupId: pair.group_id,
              error:
                participantErr instanceof Error
                  ? participantErr.message
                  : String(participantErr),
            },
            'detect_evasion_participant_failed',
          );
          // Skip participant, continue
        }
      }

      // For now, process first batch only.
      // TODO: implement proper cursor pagination in future story (FASE 6.1 note)
      hasMore = false;
    }

    this.logger.log(
      { tenantId, correlationId, flaggedCount },
      'detect_evasion_tenant_processed',
    );

    return flaggedCount;
  }

  private async insertJobLog(data: {
    jobRunId: string;
    status: string;
    durationMs: number | null;
    tenantsProcessed: number;
    participantsFlagged: number;
    errorMessage: string | null;
  }): Promise<void> {
    try {
      // Use privileged client for job log (no tenant context for global log)
      const privileged = this.createPrivilegedClient();
      try {
        await privileged.$executeRawUnsafe(
          `INSERT INTO evasion_job_log
             (id, job_run_id, status, duration_ms, tenants_processed, participants_flagged, error_message, created_at)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, now())`,
          generateId(),
          data.jobRunId,
          data.status,
          data.durationMs,
          data.tenantsProcessed,
          data.participantsFlagged,
          data.errorMessage,
        );
      } finally {
        await privileged.$disconnect();
      }
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'detect_evasion_job_log_failed (non-critical)',
      );
    }
  }
}
