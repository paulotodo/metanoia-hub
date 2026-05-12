import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue, Worker } from 'bullmq';
import { generateId } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';
import { RedisService } from '../../redis/redis.service';
import { requestContext } from '../../common/context/request-context';
import { PresenceService } from './presence.service';

const CHECKPOINT_QUEUE = 'meetings-presence-checkpoint';
const CHECKPOINT_EVERY_MS = 5 * 60 * 1000; // 5 minutes (AC2)
const ACTIVE_MEETINGS_KEY = 'rt:active-meetings'; // hash: meetingId -> tenantId

export interface CheckpointJobData {
  meetingId: string;
  tenantId: string;
}

/**
 * Story 5.3 — BullMQ repeatable job (every 5 minutes) that periodically
 * snapshots in-progress meetings to PostgreSQL for crash recovery (AC2).
 *
 * Active meetings are registered in a Redis hash by `MeetingsService.openRoom`
 * and removed on `endRoom`; the repeatable scheduler reads from that hash on
 * each tick and enqueues per-meeting checkpoint jobs.
 */
@Injectable()
export class PresenceCheckpointService implements OnModuleInit {
  private readonly logger = new Logger(PresenceCheckpointService.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly redis: RedisService,
    private readonly presence: PresenceService,
  ) {}

  async onModuleInit() {
    this.queue = this.bullMqService.createQueue(CHECKPOINT_QUEUE);

    this.worker = this.bullMqService.createWorker(
      CHECKPOINT_QUEUE,
      async (job: Job) => this.process(job),
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, error: err.message },
        'presence checkpoint job failed',
      );
    });

    // Scheduler tick (every 5 minutes) — fan out one checkpoint job per
    // currently-active meeting.
    await this.queue.add(
      'fanout',
      { fanout: true },
      {
        repeat: { every: CHECKPOINT_EVERY_MS },
        jobId: 'presence-checkpoint-fanout',
      },
    );
    this.logger.log('presence checkpoint scheduler started');
  }

  /** Called by `MeetingsService.openRoom` so the scheduler picks the meeting up. */
  async registerActiveMeeting(tenantId: string, meetingId: string): Promise<void> {
    await this.redis.hset(ACTIVE_MEETINGS_KEY, meetingId, tenantId);
  }

  /** Called by `MeetingsService.endRoom` (and final flush) to stop snapshotting. */
  async unregisterActiveMeeting(meetingId: string): Promise<void> {
    await this.redis.hdel(ACTIVE_MEETINGS_KEY, meetingId);
  }

  private async process(job: Job): Promise<void> {
    // Fanout tick: read active meetings and enqueue per-meeting checkpoints.
    if ((job.data as { fanout?: boolean }).fanout) {
      const entries = await this.redis.hgetall(ACTIVE_MEETINGS_KEY);
      const pairs = Object.entries(entries);
      for (const [meetingId, tenantId] of pairs) {
        await this.queue.add('snapshot', { meetingId, tenantId });
      }
      this.logger.log({ count: pairs.length }, 'checkpoint fanout dispatched');
      return;
    }

    // Per-meeting snapshot.
    const data = job.data as CheckpointJobData;
    await requestContext.run(
      {
        tenantId: data.tenantId,
        userId: 'system',
        requestId: generateId(),
        correlationId: generateId(),
      },
      async () => {
        await this.presence.checkpointSnapshot(data.meetingId);
      },
    );
  }
}
