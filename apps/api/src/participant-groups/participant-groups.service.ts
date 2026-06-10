import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { generateId } from '@metanoia/types';
import type {
  ParticipantGroupsListResponse,
  ParticipantGroupDetailResponse,
} from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { RedisService } from '../redis/redis.service';
import { ParticipantGroupsRepository } from './participant-groups.repository';
import { mapToSummary, mapToDetail } from './participant-groups.mapper';

const FIRST_VISIT_KEY_PREFIX = 'participant:first-visit-groups:';

@Injectable()
export class ParticipantGroupsService {
  constructor(
    private readonly repository: ParticipantGroupsRepository,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * The Keycloak guard always populates `userId` for authenticated routes;
   * this narrowing makes that contract explicit at the boundary so the rest
   * of the service can treat `userId` as a non-optional string.
   */
  private requireUserId(): string {
    const { userId } = getRequestContext();
    if (!userId) {
      throw new UnauthorizedException('Missing user id in request context');
    }
    return userId;
  }

  async list(): Promise<ParticipantGroupsListResponse> {
    const userId = this.requireUserId();

    const groups = await this.repository.findGroupsForUser(userId);

    const data = await Promise.all(
      groups.map(async (group) => {
        const meeting = await this.repository.findNextMeeting(group.id);
        return mapToSummary(group, meeting);
      }),
    );

    const firstVisit = await this.consumeFirstVisitFlag(userId);

    if (firstVisit) {
      const { tenantId } = getRequestContext();
      this.eventEmitter.emit('participant.group.first_view', {
        eventId: generateId(),
        eventType: 'participant.group.first_view',
        version: 1,
        tenantId,
        timestamp: new Date().toISOString(),
        data: { userId },
        metadata: {},
      });
    }

    return { data, meta: { firstVisit } };
  }

  async detail(groupId: string): Promise<ParticipantGroupDetailResponse> {
    const userId = this.requireUserId();

    const group = await this.repository.findGroupForUser(groupId, userId);
    if (!group) {
      // 404 (not 403) — we must not leak whether the group exists in another
      // user's scope. Spec 06.5 explicitly requires existence to remain hidden.
      throw new NotFoundException('Group not found');
    }

    const meeting = await this.repository.findNextMeeting(group.id);
    const data = mapToDetail(group, meeting, userId);

    return { data };
  }

  /**
   * Returns true on the very first call for a given user, false thereafter.
   * Uses Redis SETNX so the read+write is atomic and survives without a
   * dedicated DB column. The flag never expires — once a user has visited
   * the participant groups list, that fact is permanent.
   */
  private async consumeFirstVisitFlag(userId: string): Promise<boolean> {
    const key = `${FIRST_VISIT_KEY_PREFIX}${userId}`;
    const created = await this.redis.set(key, '1', 'NX');
    return created === 'OK';
  }
}
