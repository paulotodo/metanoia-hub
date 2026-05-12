import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { MeetingsService } from './meetings.service';
import { requestContext } from '../common/context/request-context';

function createMocks() {
  const repository = {
    findDetailById: vi.fn(),
    findById: vi.fn(),
    markRoomOpened: vi.fn(),
    markRoomEnded: vi.fn(),
    createMeeting: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    markCancelled: vi.fn(),
  };

  const livekit = {
    roomNameFor: vi.fn((t: string, m: string) => `${t}:${m}`),
    openRoom: vi.fn(),
    closeRoom: vi.fn(),
    generateJoinToken: vi.fn(),
    getLivekitUrl: vi.fn(() => 'ws://localhost:7880'),
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

function meetingRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-04-20T19:00:00.000Z');
  return {
    id: '01912345-6789-7000-8000-000000000100',
    tenantId: '01912345-6789-7000-8000-000000000001',
    groupId: '01912345-6789-7000-8000-000000000200',
    title: null,
    scheduledFor: new Date('2026-04-20T19:30:00.000Z'),
    durationMinutes: null,
    status: 'scheduled',
    topic: null,
    livekitRoomId: null,
    startedAt: null,
    endedAt: null,
    cancelledAt: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
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

  describe('create (Story 5.1)', () => {
    it('persists meeting with createdBy from RequestContext and emits domain event', async () => {
      mocks.repository.createMeeting.mockResolvedValue(
        meetingRow({ groupId: GROUP, title: 'Encontro', durationMinutes: 90, createdBy: USER }),
      );

      const result = await withCtx(() =>
        mocks.service.create({
          groupId: GROUP,
          title: 'Encontro',
          scheduledFor: '2026-04-20T19:30:00.000Z',
          durationMinutes: 90,
        }),
      );

      expect(mocks.repository.createMeeting).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: GROUP,
          title: 'Encontro',
          durationMinutes: 90,
          createdBy: USER,
        }),
      );
      expect(mocks.eventEmitter.emit).toHaveBeenCalledWith(
        'meetings.meeting.created',
        expect.objectContaining({ tenantId: TENANT }),
      );
      expect(result.title).toBe('Encontro');
      expect(result.durationMinutes).toBe(90);
      expect(result.status).toBe('scheduled');
    });
  });

  describe('list (Story 5.1)', () => {
    it('returns paginated meetings with meta', async () => {
      mocks.repository.list.mockResolvedValue({
        rows: [meetingRow(), meetingRow({ id: '01912345-6789-7000-8000-000000000101' })],
        total: 2,
      });

      const result = await withCtx(() =>
        mocks.service.list({ page: 1, perPage: 20 }),
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ page: 1, perPage: 20, total: 2, totalPages: 1 });
    });

    it('computes totalPages with ceil division', async () => {
      mocks.repository.list.mockResolvedValue({ rows: [], total: 25 });

      const result = await withCtx(() =>
        mocks.service.list({ page: 2, perPage: 10 }),
      );

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('findById (Story 5.1)', () => {
    it('returns 404 when meeting missing', async () => {
      mocks.repository.findById.mockResolvedValue(null);
      await expect(
        withCtx(() => mocks.service.findById(MEETING)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update (Story 5.1)', () => {
    it('applies partial patch with new Date for scheduledFor', async () => {
      mocks.repository.update.mockResolvedValue(
        meetingRow({ title: 'Atualizado', scheduledFor: new Date('2026-05-01T20:00:00.000Z') }),
      );
      await withCtx(() =>
        mocks.service.update(MEETING, {
          title: 'Atualizado',
          scheduledFor: '2026-05-01T20:00:00.000Z',
        }),
      );
      const call = mocks.repository.update.mock.calls[0]!;
      expect(call[0]).toBe(MEETING);
      expect(call[1]).toEqual({
        title: 'Atualizado',
        scheduledFor: new Date('2026-05-01T20:00:00.000Z'),
      });
    });

    it('throws 404 when meeting missing', async () => {
      mocks.repository.update.mockResolvedValue(null);
      await expect(
        withCtx(() => mocks.service.update(MEETING, { title: 'X' })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancel (Story 5.1)', () => {
    it('rejects cancelling a live meeting', async () => {
      mocks.repository.findById.mockResolvedValue(meetingRow({ status: 'live' }));
      await expect(
        withCtx(() => mocks.service.cancel(MEETING)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mocks.repository.markCancelled).not.toHaveBeenCalled();
    });

    it('is idempotent for already-cancelled meetings', async () => {
      mocks.repository.findById.mockResolvedValue(meetingRow({ status: 'cancelled' }));
      const result = await withCtx(() => mocks.service.cancel(MEETING));
      expect(mocks.repository.markCancelled).not.toHaveBeenCalled();
      expect(result.status).toBe('cancelled');
    });

    it('marks scheduled meeting cancelled and emits event', async () => {
      mocks.repository.findById.mockResolvedValue(meetingRow({ status: 'scheduled' }));
      mocks.repository.markCancelled.mockResolvedValue(
        meetingRow({ status: 'cancelled', cancelledAt: new Date() }),
      );
      const result = await withCtx(() => mocks.service.cancel(MEETING));
      expect(mocks.repository.markCancelled).toHaveBeenCalledWith(
        MEETING,
        expect.any(Date),
      );
      expect(mocks.eventEmitter.emit).toHaveBeenCalledWith(
        'meetings.meeting.cancelled',
        expect.objectContaining({ tenantId: TENANT }),
      );
      expect(result.status).toBe('cancelled');
    });
  });

  describe('join (Story 5.1)', () => {
    it('generates a join token only for live meetings', async () => {
      mocks.repository.findById.mockResolvedValue(meetingRow({ status: 'scheduled' }));
      await expect(
        withCtx(() => mocks.service.join(MEETING)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns roomName + token + livekitUrl for live meetings', async () => {
      mocks.repository.findById.mockResolvedValue(meetingRow({ status: 'live' }));
      mocks.livekit.generateJoinToken.mockResolvedValue('jwt-join-token');

      const result = await withCtx(() => mocks.service.join(MEETING));

      expect(mocks.livekit.generateJoinToken).toHaveBeenCalledWith(
        expect.objectContaining({
          roomName: `${TENANT}:${MEETING}`,
          userId: USER,
        }),
      );
      expect(result.joinToken).toBe('jwt-join-token');
      expect(result.livekitUrl).toBe('ws://localhost:7880');
    });
  });
});
