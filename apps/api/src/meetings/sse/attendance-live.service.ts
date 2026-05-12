import { Injectable } from '@nestjs/common';
import type {
  AttendanceLiveSnapshot,
  LiveParticipant,
  LiveParticipantStatus,
} from '@metanoia/types';
import { getRequestContext } from '../../common/context/request-context';
import { RedisService } from '../../redis/redis.service';

interface PresenceHashValue {
  joinedAt?: string;
  leftAt?: string | null;
  participantSid?: string;
  cameraOn?: boolean;
  name?: string;
}

/**
 * Story 5.5 — assembles the initial `AttendanceLiveSnapshot` from the Redis
 * presence hash maintained by `MeetingEventService`. Pure read; no
 * PostgreSQL involvement (NFR-P4 ≤ 1s latency).
 */
@Injectable()
export class AttendanceLiveService {
  constructor(private readonly redis: RedisService) {}

  async snapshot(meetingId: string): Promise<AttendanceLiveSnapshot> {
    const { tenantId } = getRequestContext();
    const key = `rt:meeting:${tenantId}:${meetingId}:presence`;
    const raw = await this.redis.hgetall(key);
    const now = new Date();

    const participants: LiveParticipant[] = Object.entries(raw).map(
      ([userId, json]) => {
        const parsed = safeParse(json);
        const status: LiveParticipantStatus = parsed.leftAt ? 'saiu' : 'na-sala';
        const joinedAt = parsed.joinedAt ?? now.toISOString();
        const leftAt = parsed.leftAt ?? null;
        const endMs = leftAt ? new Date(leftAt).getTime() : now.getTime();
        const startMs = new Date(joinedAt).getTime();
        const currentDurationSeconds = Math.max(
          0,
          Math.round((endMs - startMs) / 1000),
        );
        return {
          userId,
          name: parsed.name ?? null,
          status,
          currentDurationSeconds,
          cameraOn: parsed.cameraOn ?? false,
          joinedAt,
          leftAt,
        };
      },
    );

    return {
      type: 'snapshot',
      meetingId,
      capturedAt: now.toISOString(),
      participants,
    };
  }
}

function safeParse(json: string): PresenceHashValue {
  try {
    return JSON.parse(json) as PresenceHashValue;
  } catch {
    return {};
  }
}
