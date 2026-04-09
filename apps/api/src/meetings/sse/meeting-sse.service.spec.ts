import { MeetingSseService } from './meeting-sse.service';
import Redis from 'ioredis';

vi.mock('ioredis', () => {
  const proto = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  };
  // Must be a real constructor function for `new Redis(...)` to work
  function MockRedis() {
    return Object.create(proto);
  }
  MockRedis.prototype = proto;
  return { default: MockRedis, __esModule: true };
});

describe('MeetingSseService', () => {
  let service: MeetingSseService;

  const mockConfigService = {
    get: (key: string) => {
      const config: Record<string, string | number> = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
      };
      return config[key];
    },
  };

  beforeEach(() => {
    service = new MeetingSseService(mockConfigService as never);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return an observable when subscribing', () => {
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    const meetingId = '660e8400-e29b-41d4-a716-446655440001';

    const observable = service.subscribe(tenantId, meetingId);
    expect(observable).toBeDefined();
    expect(observable.subscribe).toBeDefined();
  });
});
