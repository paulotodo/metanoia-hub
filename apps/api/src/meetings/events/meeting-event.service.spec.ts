import { Test } from '@nestjs/testing';
import { MeetingEventService } from './meeting-event.service';
import { RedisService } from '../../redis/redis.service';
import { BullMqService } from '../../bullmq/bullmq.service';
import { requestContext } from '../../common/context/request-context';

describe('MeetingEventService', () => {
  let service: MeetingEventService;
  let mockRedis: { hset: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn> };
  let mockQueueAdd: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockRedis = {
      hset: vi.fn().mockResolvedValue(1),
      publish: vi.fn().mockResolvedValue(1),
    };

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
});
