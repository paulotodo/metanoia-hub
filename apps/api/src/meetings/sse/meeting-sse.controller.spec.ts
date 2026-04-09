import { Test } from '@nestjs/testing';
import { Observable } from 'rxjs';
import { MeetingSseController } from './meeting-sse.controller';
import { MeetingSseService } from './meeting-sse.service';
import { requestContext } from '../../common/context/request-context';

describe('MeetingSseController', () => {
  let controller: MeetingSseController;

  const mockSseService = {
    subscribe: vi.fn().mockReturnValue(new Observable()),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MeetingSseController],
      providers: [
        {
          provide: MeetingSseService,
          useValue: mockSseService,
        },
      ],
    }).compile();

    controller = module.get(MeetingSseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return an observable scoped to tenant', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const meetingId = '660e8400-e29b-41d4-a716-446655440001';

    requestContext.run(
      {
        tenantId,
        userId: 'user-1',
        requestId: 'req-1',
        correlationId: 'corr-1',
      },
      () => {
        const result = controller.stream(meetingId);
        expect(result).toBeInstanceOf(Observable);
        expect(mockSseService.subscribe).toHaveBeenCalledWith(
          tenantId,
          meetingId,
        );
      },
    );
  });
});
