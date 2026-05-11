import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Worker } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { generateId } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { requestContext } from '../../common/context/request-context';

const MEETINGS_QUEUE = 'meetings';

interface MeetingJobData {
  eventId: string;
  eventType: string;
  version: number;
  tenantId: string;
  meetingId: string;
  userId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class MeetingEventWorker implements OnModuleInit {
  private readonly logger = new Logger(MeetingEventWorker.name);
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.worker = this.bullMqService.createWorker(
      MEETINGS_QUEUE,
      async (job: Job<MeetingJobData>) => this.process(job),
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'meeting event job failed',
      );
    });

    this.logger.log('meeting event worker started');
  }

  private async process(job: Job<MeetingJobData>): Promise<void> {
    const { tenantId, meetingId, eventType, userId, data, eventId } = job.data;

    // Worker runs outside HTTP lifecycle — manually set RequestContext for RLS
    await requestContext.run(
      {
        tenantId,
        userId: userId ?? 'system',
        requestId: generateId(),
        correlationId: eventId,
      },
      async () => {
        try {
          // Idempotency: skip if event already persisted (retry safety)
          const existing = await withTenantTx(this.prisma, (tx) =>
            tx.meetingEvent.findFirst({
              where: { meetingId, eventType, userId: userId ?? null, version: job.data.version },
              select: { id: true },
            }),
          );

          if (existing) {
            this.logger.warn(
              { tenantId, meetingId, eventId, jobId: job.id },
              'duplicate event skipped (idempotency)',
            );
            return;
          }

          await withTenantTx(this.prisma, (tx) =>
            tx.meetingEvent.create({
              data: {
                id: generateId(),
                tenantId,
                meetingId,
                eventType,
                userId: userId ?? null,
                payload: (data ?? {}) as Prisma.InputJsonValue,
                version: job.data.version,
              },
            }),
          );

          this.logger.log(
            { tenantId, meetingId, eventId, jobId: job.id },
            'event flushed to postgresql',
          );
        } catch (error) {
          this.logger.error(
            { tenantId, meetingId, eventId, jobId: job.id, error: (error as Error).message },
            'failed to flush event to postgresql',
          );
          throw error; // Re-throw so BullMQ retries
        }
      },
    );
  }
}
