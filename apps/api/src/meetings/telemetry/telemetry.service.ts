import { Injectable, Logger } from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import { computeTelemetry, type CameraSegment } from '@metanoia/types';
import type { MeetingTelemetry } from '@prisma/client';
import { RedisService } from '../../redis/redis.service';
import { ConsentRepository } from '../../consent/consent.repository';
import { MeetingsRepository } from '../meetings.repository';
import { PresenceService } from '../presence/presence.service';
import { TelemetryRepository } from './telemetry.repository';

/**
 * Story 5.4 — flushes engagement telemetry (camera on time, room duration,
 * focus score) per (meeting, user) into `meeting_telemetry`. Idempotent
 * upsert keyed on `(meetingId, userId)`.
 *
 * Inputs are the Story 5.3 attendance compute (for room duration), the
 * track.published/unpublished trail in `meeting_events` (camera segments),
 * and the focus heartbeat aggregator in Redis (`rt:meeting:{tenantId}:{meetingId}:focus:{userId}`).
 */
@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private readonly meetings: MeetingsRepository,
    private readonly presence: PresenceService,
    private readonly telemetry: TelemetryRepository,
    private readonly redis: RedisService,
    private readonly consentRepo: ConsentRepository,
  ) {}

  async flushTelemetry(
    meetingId: string,
    focusEnabled: boolean,
  ): Promise<MeetingTelemetry[]> {
    const meeting = await this.meetings.findById(meetingId);
    if (!meeting) {
      this.logger.warn({ meetingId }, 'flushTelemetry: meeting not found');
      return [];
    }

    const attendance = await this.presence.listAttendance(meetingId);
    const tracks = await this.telemetry.listTrackEventsByMeeting(meetingId);

    // Fold track events into open/close camera segments per user. Only
    // `video` kind contributes to camera_on_seconds (other tracks ignored
    // by AC1).
    const cameraSegmentsByUser = new Map<string, CameraSegment[]>();
    const openByUser = new Map<string, string>();
    for (const ev of tracks) {
      const userId = ev.userId;
      if (!userId) continue;
      const payload = (ev.payload ?? {}) as { trackKind?: string };
      if (payload.trackKind !== 'video') continue;
      const tsIso = ev.createdAt.toISOString();

      if (ev.eventType === 'meetings.track.published') {
        openByUser.set(userId, tsIso);
      } else {
        const start = openByUser.get(userId);
        if (start) {
          const list = cameraSegmentsByUser.get(userId) ?? [];
          list.push({ start, end: tsIso });
          cameraSegmentsByUser.set(userId, list);
          openByUser.delete(userId);
        }
      }
    }
    // Close any still-open segments using meeting.endedAt (or now).
    const closingIso = (meeting.endedAt ?? new Date()).toISOString();
    for (const [userId, start] of openByUser) {
      const list = cameraSegmentsByUser.get(userId) ?? [];
      list.push({ start, end: closingIso });
      cameraSegmentsByUser.set(userId, list);
    }

    const results: MeetingTelemetry[] = [];
    for (const att of attendance) {
      const segments = cameraSegmentsByUser.get(att.userId) ?? [];
      const focus = focusEnabled
        ? await this.readFocusAggregate(meeting.tenantId, meetingId, att.userId)
        : { visibleSeconds: null, totalSeconds: null };

      const computed = computeTelemetry({
        cameraSegments: segments,
        roomDurationSeconds: att.totalDurationSeconds,
        focusVisibleSeconds: focus.visibleSeconds,
        focusTotalSeconds: focus.totalSeconds,
      });

      const row = await this.telemetry.upsertTelemetry({
        id: uuidv7(),
        meetingId,
        userId: att.userId,
        cameraOnSeconds: computed.cameraOnSeconds,
        roomDurationSeconds: computed.roomDurationSeconds,
        focusScore: computed.focusScore,
      });
      results.push(row);
    }

    this.logger.log(
      { meetingId, focusEnabled, rowsWritten: results.length },
      'telemetry flush completed',
    );
    return results;
  }

  /**
   * Aggregate counters maintained by `recordFocusHeartbeat`:
   *   `rt:meeting:{tenantId}:{meetingId}:focus:{userId}` → hash { visible, total }
   */
  private async readFocusAggregate(
    tenantId: string,
    meetingId: string,
    userId: string,
  ): Promise<{ visibleSeconds: number | null; totalSeconds: number | null }> {
    const key = `rt:meeting:${tenantId}:${meetingId}:focus:${userId}`;
    const raw = await this.redis.hgetall(key);
    if (!raw.visible && !raw.total) {
      return { visibleSeconds: null, totalSeconds: null };
    }
    const visible = Number(raw.visible ?? '0');
    const total = Number(raw.total ?? '0');
    return {
      visibleSeconds: Number.isFinite(visible) ? visible : null,
      totalSeconds: Number.isFinite(total) ? total : null,
    };
  }

  /**
   * WS gateway calls this on every 30s heartbeat from the client. Increments
   * `total` always and `visible` only when `visible: true`. The increment
   * step is constant 30s (the contract); a sliding-window approach is out of
   * scope for MVP.
   *
   * FR-11 gate: if the user has withdrawn focus_monitoring consent, silently
   * returns without recording any heartbeat data for that user. Other
   * participants in the same meeting are unaffected.
   */
  async recordFocusHeartbeat(
    tenantId: string,
    meetingId: string,
    userId: string,
    visible: boolean,
    stepSeconds = 30,
  ): Promise<void> {
    // FR-11: gate — do not collect focus data for users who withdrew consent
    const withdrawn = await this.consentRepo.hasWithdrawn(userId, 'focus_monitoring');
    if (withdrawn) {
      return;
    }

    const key = `rt:meeting:${tenantId}:${meetingId}:focus:${userId}`;
    await this.redis.hincrby(key, 'total', stepSeconds);
    if (visible) {
      await this.redis.hincrby(key, 'visible', stepSeconds);
    }
  }

}
