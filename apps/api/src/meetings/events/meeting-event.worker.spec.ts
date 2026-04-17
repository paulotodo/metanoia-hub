import { Test } from '@nestjs/testing';
import { MeetingEventWorker } from './meeting-event.worker';
import { BullMqService } from '../../bullmq/bullmq.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MeetingEventWorker', () => {
  let worker: MeetingEventWorker;
  let mockCreateWorker: ReturnType<typeof vi.fn>;
  let mockPrismaCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockPrismaCreate = vi.fn().mockResolvedValue({ id: 'event-1' });
    const mockWorkerInstance = { on: vi.fn() };
    mockCreateWorker = vi.fn().mockReturnValue(mockWorkerInstance);

    const module = await Test.createTestingModule({
      providers: [
        MeetingEventWorker,
        {
          provide: BullMqService,
          useValue: { createWorker: mockCreateWorker },
        },
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              meetingEvent: {
                create: mockPrismaCreate,
                findFirst: vi.fn().mockResolvedValue(null),
              },
            },
          },
        },
      ],
    }).compile();

    worker = module.get(MeetingEventWorker);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  it('should register worker on module init', () => {
    worker.onModuleInit();
    expect(mockCreateWorker).toHaveBeenCalledWith(
      'meetings',
      expect.any(Function),
    );
  });
});
