import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { firstValueFrom } from 'rxjs';

// The vi.mock factory is hoisted — no external variables allowed inside.
// We use a module-level EventEmitter for message routing and access the mock
// proto via the constructed instance (which uses Object.create(proto)).
const mockSubEmitter = new EventEmitter();

vi.mock('ioredis', () => {
  const proto = {
    subscribe: vi.fn().mockResolvedValue(1),
    unsubscribe: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue('OK'),
    // on() wires to the shared emitter — captured via closure inside factory
    on: vi.fn().mockReturnThis(),
  };
  function MockRedis() {
    return Object.create(proto);
  }
  MockRedis.prototype = proto;
  return { default: MockRedis, __esModule: true };
});

// Import service AFTER vi.mock declaration so it gets the mocked version
import { SseRedisService } from './sse-redis.service';

function makeMockConfig() {
  return {
    get: vi.fn((key: string) => {
      if (key === 'REDIS_HOST') return 'localhost';
      if (key === 'REDIS_PORT') return 6379;
      return undefined;
    }),
  };
}

const TENANT_A = '019756c0-aaaa-7000-8000-000000000001';
const TENANT_B = '019756c0-bbbb-7000-8000-000000000002';
const USER_X = '019756c0-xxxx-7000-8000-000000000010';

const VALID_PAYLOAD = {
  notificationId: '019756c0-0002-7000-8000-000000000099',
  type: 'group_message',
  title: 'Nova mensagem',
  body: 'Paulo enviou uma mensagem',
  createdAt: '2026-06-20T00:00:00.000Z',
};

describe('SseRedisService', () => {
  let service: SseRedisService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubEmitter.removeAllListeners();

    const mockConfig = makeMockConfig();
    service = new SseRedisService(mockConfig as any);

    // Wire the `on()` mock to the shared EventEmitter so that
    // subscriber.on('message', handler) correctly registers the handler.
    // The subscriber instance is a private field, so we access it via the
    // prototype mock — when on() is called during construction, we capture handler.
    // We re-use the mockSubEmitter by overriding the mock implementation here.
    const subscriberInstance = (service as any).subscriber as {
      on: ReturnType<typeof vi.fn>;
    };
    if (subscriberInstance?.on?.mock) {
      // Replay calls: the subscriber.on was called in the constructor; re-wire
      // by using the emitter directly. Find the 'message' handler from mock calls.
      const calls = subscriberInstance.on.mock.calls as [string, (...args: unknown[]) => void][];
      for (const [event, handler] of calls) {
        mockSubEmitter.on(event, handler);
      }
    }
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('SC-05: valid notification payload', () => {
    it('emits MessageEvent with correct fields when valid payload received', async () => {
      const observable = service.subscribe(TENANT_A, USER_X);
      const eventPromise = firstValueFrom(observable);

      const channel = `rt:notifications:${TENANT_A}:${USER_X}`;
      mockSubEmitter.emit('message', channel, JSON.stringify(VALID_PAYLOAD));

      const event = await eventPromise;
      const parsed = JSON.parse((event as any).data);

      expect(parsed).toMatchObject({
        id: VALID_PAYLOAD.notificationId,
        type: VALID_PAYLOAD.type,
        title: VALID_PAYLOAD.title,
        body: VALID_PAYLOAD.body,
        createdAt: VALID_PAYLOAD.createdAt,
      });
      expect(parsed.notificationId).toBeUndefined();
    });
  });

  describe('notificationId → id mapping', () => {
    it('renames notificationId to id in SSE wire format', async () => {
      const observable = service.subscribe(TENANT_A, USER_X);
      const eventPromise = firstValueFrom(observable);

      const channel = `rt:notifications:${TENANT_A}:${USER_X}`;
      mockSubEmitter.emit('message', channel, JSON.stringify(VALID_PAYLOAD));

      const event = await eventPromise;
      const parsed = JSON.parse((event as any).data);
      expect(parsed.id).toBe(VALID_PAYLOAD.notificationId);
      expect(parsed.notificationId).toBeUndefined();
    });
  });

  describe('SC-06: cross-tenant isolation', () => {
    it('Observable for tenantB does NOT emit events published for tenantA', async () => {
      const emittedForB: unknown[] = [];
      const sub = service.subscribe(TENANT_B, USER_X).subscribe((evt) => {
        emittedForB.push(evt);
      });

      // Publish message ONLY for tenantA
      const channelA = `rt:notifications:${TENANT_A}:${USER_X}`;
      mockSubEmitter.emit('message', channelA, JSON.stringify(VALID_PAYLOAD));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(emittedForB).toHaveLength(0);
      sub.unsubscribe();
    });
  });

  describe('EC-06: malformed payload', () => {
    it('does not emit event on invalid JSON and keeps observer active', async () => {
      const emitted: unknown[] = [];
      const sub = service.subscribe(TENANT_A, USER_X).subscribe((evt) => {
        emitted.push(evt);
      });

      const channel = `rt:notifications:${TENANT_A}:${USER_X}`;
      mockSubEmitter.emit('message', channel, 'not-valid-json');

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(emitted).toHaveLength(0);

      // Observer must remain alive: valid message arrives after malformed one
      mockSubEmitter.emit('message', channel, JSON.stringify(VALID_PAYLOAD));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(emitted).toHaveLength(1);

      sub.unsubscribe();
    });

    it('does not emit event when Zod schema validation fails', async () => {
      const emitted: unknown[] = [];
      const sub = service.subscribe(TENANT_A, USER_X).subscribe((evt) => {
        emitted.push(evt);
      });

      const channel = `rt:notifications:${TENANT_A}:${USER_X}`;
      mockSubEmitter.emit('message', channel, JSON.stringify({ type: 'unknown_type' }));

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(emitted).toHaveLength(0);
      sub.unsubscribe();
    });
  });

  describe('basic functionality', () => {
    it('returns an Observable when subscribing', () => {
      const observable = service.subscribe(TENANT_A, USER_X);
      expect(observable).toBeDefined();
      expect(typeof observable.subscribe).toBe('function');
    });

    it('service is defined after construction', () => {
      expect(service).toBeDefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('calls quit on the subscriber Redis connection', async () => {
      const subscriberInstance = (service as any).subscriber as {
        quit: ReturnType<typeof vi.fn>;
      };
      await service.onModuleDestroy();
      expect(subscriberInstance.quit).toHaveBeenCalledTimes(1);
    });
  });
});
