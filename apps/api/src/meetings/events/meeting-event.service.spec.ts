import { Test } from '@nestjs/testing';
import { MeetingEventService } from './meeting-event.service';
import { RedisService } from '../../redis/redis.service';
import { BullMqService } from '../../bullmq/bullmq.service';
import { requestContext } from '../../common/context/request-context';

describe('MeetingEventService', () => {
  let service: MeetingEventService;
  let mockRedis: {
    hset: ReturnType<typeof vi.fn>;
    hget: ReturnType<typeof vi.fn>;
    hdel: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  let mockQueueAdd: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockRedis = {
      hset: vi.fn().mockResolvedValue(1),
      hget: vi.fn().mockResolvedValue(null),
      hdel: vi.fn().mockResolvedValue(1),
      publish: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
    } as never;

    mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

    const module = await Test.createTestingModule({
      providers: [
        MeetingEventService,
        {
          provide: RedisService,
          useValue: mockRedis,
        },
        {
          provide: BullMqService,
          useValue: {
            createQueue: () => ({ add: mockQueueAdd }),
          },
        },
      ],
    }).compile();

    service = module.get(MeetingEventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should store presence in Redis, publish event, and enqueue job', async () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const meetingId = '660e8400-e29b-41d4-a716-446655440001';
    const userId = '770e8400-e29b-41d4-a716-446655440002';

    await requestContext.run(
      {
        tenantId,
        userId,
        requestId: 'req-1',
        correlationId: 'corr-1',
      },
      async () => {
        await service.handleParticipantJoined({
          meetingId,
          userId,
          eventType: 'meetings.participant.joined',
          payload: { roomSid: 'room-sid' },
        });
      },
    );

    // Verify Redis HSET for presence
    expect(mockRedis.hset).toHaveBeenCalledWith(
      `rt:meeting:${tenantId}:${meetingId}:presence`,
      userId,
      expect.any(String),
    );

    // Verify Redis PUBLISH for SSE
    expect(mockRedis.publish).toHaveBeenCalledWith(
      `rt:meeting:${tenantId}:${meetingId}:events`,
      expect.any(String),
    );

    // Verify BullMQ job enqueued
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'participant-joined',
      expect.objectContaining({
        tenantId,
        meetingId,
        userId,
        eventType: 'meetings.participant.joined',
      }),
    );
  });

  describe('webhook dedup (Story 5.3 — SETNX webhook:{providerEventId})', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const meetingId = '660e8400-e29b-41d4-a716-446655440001';
    const userId = '770e8400-e29b-41d4-a716-446655440002';

    async function fire(providerEventId?: string) {
      await requestContext.run(
        {
          tenantId,
          userId,
          requestId: 'req',
          correlationId: 'corr',
        },
        async () => {
          await service.handleParticipantJoined({
            meetingId,
            userId,
            eventType: 'meetings.participant.joined',
            payload: {},
            providerEventId,
          });
        },
      );
    }

    it('claims providerEventId via Redis SETNX with TTL 3600s', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');
      await fire('ev-1');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'webhook:ev-1',
        '1',
        'EX',
        3600,
        'NX',
      );
    });

    it('skips processing when SETNX returns null (duplicate)', async () => {
      mockRedis.set.mockResolvedValueOnce(null);
      await fire('ev-dup');
      expect(mockRedis.hset).not.toHaveBeenCalled();
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('processes when providerEventId is omitted (legacy path)', async () => {
      await fire(undefined);
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockRedis.hset).toHaveBeenCalled();
    });
  });

  describe('handleParticipantLeft (Story 5.3)', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const meetingId = '660e8400-e29b-41d4-a716-446655440001';
    const userId = '770e8400-e29b-41d4-a716-446655440002';

    it('writes leftAt into presence hash and enqueues participant-left job', async () => {
      mockRedis.hget.mockResolvedValueOnce(
        JSON.stringify({ joinedAt: '2026-04-20T19:30:00.000Z' }),
      );

      await requestContext.run(
        {
          tenantId,
          userId,
          requestId: 'req',
          correlationId: 'corr',
        },
        async () => {
          await service.handleParticipantLeft({
            meetingId,
            userId,
            payload: { participantSid: 'PA' },
            providerEventId: 'ev-left-1',
          });
        },
      );

      const presenceKey = `rt:meeting:${tenantId}:${meetingId}:presence`;
      expect(mockRedis.hget).toHaveBeenCalledWith(presenceKey, userId);
      expect(mockRedis.hset).toHaveBeenCalledWith(
        presenceKey,
        userId,
        expect.stringContaining('leftAt'),
      );
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'participant-left',
        expect.objectContaining({
          tenantId,
          meetingId,
          userId,
          eventType: 'meetings.participant.left',
        }),
      );
    });
  });
});
