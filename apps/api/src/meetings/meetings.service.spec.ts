import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { MeetingsService } from './meetings.service';
import { requestContext } from '../common/context/request-context';

function createMocks() {
  const repository = {
    findDetailById: vi.fn(),
    findById: vi.fn(),
    markRoomOpened: vi.fn(),
    markRoomEnded: vi.fn(),
  };

  const livekit = {
    roomNameFor: vi.fn((t: string, m: string) => `${t}:${m}`),
    openRoom: vi.fn(),
    closeRoom: vi.fn(),
  };

  const eventEmitter = {
    emit: vi.fn(),
  };

  const service = new MeetingsService(
    repository as any,
    livekit as any,
    eventEmitter as any,
  );

  return { service, repository, livekit, eventEmitter };
}

const TENANT = '01912345-6789-7000-8000-000000000001';
const USER = '01912345-6789-7000-8000-0000000000aa';
const MEETING = '01912345-6789-7000-8000-000000000100';
const GROUP = '01912345-6789-7000-8000-000000000200';

async function withCtx<T>(fn: () => Promise<T>, userId = USER): Promise<T> {
  return requestContext.run(
    { tenantId: TENANT, userId, requestId: generateId(), correlationId: generateId() },
    fn,
  );
}

describe('MeetingsService', () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  describe('getDetail', () => {
    it('hydrates MeetingDetail from meeting + group + participants', async () => {
      mocks.repository.findDetailById.mockResolvedValue({
        id: MEETING,
        tenantId: TENANT,
        groupId: GROUP,
        scheduledFor: new Date('2026-04-20T19:30:00.000Z'),
        status: 'scheduled',
        topic: 'O pão partido',
        livekitRoomId: null,
        startedAt: null,
        endedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        group: { id: GROUP, name: 'Célula da Paz' },
        participants: [
          {
            id: generateId(),
            tenantId: TENANT,
            meetingId: MEETING,
            userId: null,
            participantId: generateId(),
            name: 'Ana',
            response: 'yes',
            joinedAt: null,
            leftAt: null,
            createdAt: new Date(),
          },
        ],
      });

      const result = await withCtx(() => mocks.service.getDetail(MEETING));

      expect(result.meetingId).toBe(MEETING);
      expect(result.groupName).toBe('Célula da Paz');
      expect(result.status).toBe('scheduled');
      expect(result.topic).toBe('O pão partido');
      expect(result.confirmed).toHaveLength(1);
      expect(result.confirmed[0]!.response).toBe('yes');
      expect(result.milestones).toEqual([]);
    });

    it('throws NotFoundException when meeting is missing', async () => {
      mocks.repository.findDetailById.mockResolvedValue(null);

      await expect(withCtx(() => mocks.service.getDetail(MEETING))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('openRoom', () => {
    it('opens LiveKit room, marks meeting live, emits meetings.room.opened', async () => {
      mocks.repository.findById.mockResolvedValue({
        id: MEETING,
        tenantId: TENANT,
        status: 'scheduled',
      });
      mocks.livekit.openRoom.mockResolvedValue({
        roomId: 'RM_abc',
        roomName: `${TENANT}:${MEETING}`,
        joinToken: 'jwt-token',
        livekitUrl: 'ws://localhost:7880',
      });
      mocks.repository.markRoomOpened.mockResolvedValue({});

      const result = await withCtx(() => mocks.service.openRoom(MEETING));

      expect(mocks.livekit.openRoom).toHaveBeenCalledWith(TENANT, MEETING, USER, USER);
      expect(mocks.repository.markRoomOpened).toHaveBeenCalledWith(
        MEETING,
        'RM_abc',
        expect.any(Date),
      );
      expect(mocks.eventEmitter.emit).toHaveBeenCalledWith(
        'meetings.room.opened',
        expect.objectContaining({ tenantId: TENANT, userId: USER, meetingId: MEETING }),
      );
      expect(result.joinToken).toBe('jwt-token');
    });

    it('throws ForbiddenException if meeting already ended', async () => {
      mocks.repository.findById.mockResolvedValue({
        id: MEETING,
        tenantId: TENANT,
        status: 'ended',
      });

      await expect(withCtx(() => mocks.service.openRoom(MEETING))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mocks.livekit.openRoom).not.toHaveBeenCalled();
    });
  });

  describe('endRoom', () => {
    it('closes LiveKit, marks meeting ended, emits meetings.room.ended', async () => {
      mocks.repository.findById.mockResolvedValue({
        id: MEETING,
        tenantId: TENANT,
        status: 'live',
      });
      mocks.repository.markRoomEnded.mockResolvedValue({});

      const result = await withCtx(() => mocks.service.endRoom(MEETING));

      expect(mocks.livekit.closeRoom).toHaveBeenCalledWith(TENANT, MEETING);
      expect(mocks.eventEmitter.emit).toHaveBeenCalledWith(
        'meetings.room.ended',
        expect.objectContaining({ tenantId: TENANT, meetingId: MEETING }),
      );
      expect(result.meetingId).toBe(MEETING);
      expect(typeof result.endedAt).toBe('string');
    });
  });
});
