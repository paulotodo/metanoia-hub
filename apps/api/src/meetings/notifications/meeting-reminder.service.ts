import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { MEETING_REMINDER_MINUTES } from '@metanoia/types';
import { BullMqService } from '../../bullmq/bullmq.service';

const NOTIFICATIONS_QUEUE = 'notifications';

export interface MeetingReminderPayload {
  tenantId: string;
  meetingId: string;
  groupId: string;
  scheduledFor: string;
}

/**
 * Story 5.6 — schedules a BullMQ delayed job to fire
 * `MEETING_REMINDER_MINUTES` before the meeting's scheduled time. The real
 * notification provider (email/push) is deferred to Epic 12 — for now the
 * job is a stub that logs + enqueues onto `queue:notifications`.
 *
 * Story 5.1 `MeetingsService.create` should call `scheduleReminder` after
 * persistence; cancel/reschedule on update or cancel is out of scope for
 * MVP (jobs simply fire and the worker no-ops if the meeting is gone).
 */
@Injectable()
export class MeetingReminderService {
  private readonly logger = new Logger(MeetingReminderService.name);
  private readonly queue: Queue;

  constructor(bullMqService: BullMqService) {
    this.queue = bullMqService.createQueue(NOTIFICATIONS_QUEUE);
  }

  async scheduleReminder(payload: MeetingReminderPayload): Promise<string | null> {
    const scheduledAtMs = new Date(payload.scheduledFor).getTime();
    if (Number.isNaN(scheduledAtMs)) {
      this.logger.warn(
        { meetingId: payload.meetingId, scheduledFor: payload.scheduledFor },
        'reminder skip: invalid scheduledFor',
      );
      return null;
    }
    const fireAtMs =
      scheduledAtMs - MEETING_REMINDER_MINUTES * 60 * 1000;
    const delayMs = Math.max(0, fireAtMs - Date.now());

    const job = await this.queue.add(
      'meeting-reminder',
      payload,
      {
        delay: delayMs,
        // Idempotency — at most one pending reminder per meeting.
        jobId: `meeting-reminder:${payload.meetingId}`,
      },
    );
    this.logger.log(
      { meetingId: payload.meetingId, jobId: job.id, delayMs },
      'meeting reminder scheduled',
    );
    return String(job.id);
  }
}
