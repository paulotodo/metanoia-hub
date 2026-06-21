import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { HttpException, HttpStatus } from '@nestjs/common';

// Mock ioredis and uuidv7 before importing service code
const mockSubEmitter = new EventEmitter();
const mockSubscriberMethods = {
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    mockSubEmitter.on(event, handler);
    return mockSubscriberMethods;
  }),
};

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockSubscriberMethods),
}));

vi.mock('uuidv7', () => ({
  uuidv7: vi.fn(() => `conn-${Date.now()}-${Math.random()}`),
}));

// Mock getRequestContext per-test via the module mock
let mockTenantId = '019756c0-1111-7000-8000-000000000001';
let mockUserId = '019756c0-1111-7000-8000-000000000002';

vi.mock('../../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: mockTenantId,
    userId: mockUserId,
    requestId: 'test-req',
    correlationId: 'test-corr',
  })),
}));

import { SseRedisService } from './sse-redis.service';
import { SseConnectionManager } from './sse-connection.manager';
import { SseController } from './sse.controller';

const TENANT_A = '019756c0-aaaa-7000-8000-000000000001';
const TENANT_B = '019756c0-bbbb-7000-8000-000000000002';
const USER_X = '019756c0-xxxx-7000-8000-000000000010';

const VALID_PAYLOAD = {
  notificationId: '019756c0-0002-7000-8000-000000000099',
  type: 'group_message' as const,
  title: 'Test notification',
  body: 'Integration test body',
  createdAt: '2026-06-20T12:00:00.000Z',
};

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn((key: string) => {
      const defaults: Record<string, unknown> = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        SSE_MAX_CONNECTIONS: 100,
        SSE_MAX_PER_USER: 3,
        SSE_HEARTBEAT_INTERVAL_MS: 30000,
      };
      return overrides[key] ?? defaults[key];
    }),
  };
}

function makeRedisService(configService = makeConfig()) {
  return new SseRedisService(configService as any);
}

function makeConnectionManager(configService = makeConfig()) {
  const mockRedis = {
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zcard: vi.fn().mockResolvedValue(0),
    zrange: vi.fn().mockResolvedValue([]),
  };
  const manager = new SseConnectionManager(configService as any, mockRedis as any);
  manager.onModuleInit();
  return { manager, mockRedis };
}

describe('SSE Integration', () => {
  let redisService: SseRedisService;
  let connectionManager: SseConnectionManager;
  let mockRedis: ReturnType<typeof makeConnectionManager>['mockRedis'];
  let controller: SseController;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubEmitter.removeAllListeners();
    mockSubscriberMethods.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      mockSubEmitter.on(event, handler);
      return mockSubscriberMethods;
    });

    const config = makeConfig();
    redisService = makeRedisService(config);
    const cm = makeConnectionManager(config);
    connectionManager = cm.manager;
    mockRedis = cm.mockRedis;

    controller = new SseController(connectionManager as any, redisService as any, config as any);
  });

  afterEach(async () => {
    await redisService.onModuleDestroy();
  });

  describe('SC-05: dispatch→SSE end-to-end', () => {
    it('publishes Redis message and Observable emits SSE event with correct shape', async () => {
      mockTenantId = TENANT_A;
      mockUserId = USER_X;

      const emitted: MessageEvent[] = [];
      const sub = controller.stream().subscribe((evt) => emitted.push(evt));

      // Wait for async setup
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Simulate Redis pub/sub message
      const channel = `rt:notifications:${TENANT_A}:${USER_X}`;
      mockSubEmitter.emit('message', channel, JSON.stringify(VALID_PAYLOAD));

      await new Promise((resolve) => setTimeout(resolve, 50));

      const notifications = emitted.filter((e) => (e as any).type !== 'heartbeat');
      expect(notifications).toHaveLength(1);

      const parsed = JSON.parse((notifications[0] as any).data);
      expect(parsed).toMatchObject({
        id: VALID_PAYLOAD.notificationId,
        type: VALID_PAYLOAD.type,
        title: VALID_PAYLOAD.title,
        body: VALID_PAYLOAD.body,
        createdAt: VALID_PAYLOAD.createdAt,
      });
      expect(parsed.notificationId).toBeUndefined();

      sub.unsubscribe();
    });
  });

  describe('SC-06: cross-tenant isolation (MANDATORY — constitution check)', () => {
    it('Observable for tenantB does NOT emit events published for tenantA', async () => {
      mockTenantId = TENANT_B;
      mockUserId = USER_X;

      const emittedForB: MessageEvent[] = [];
      const sub = controller.stream().subscribe((evt) => {
        if ((evt as any).type !== 'heartbeat') emittedForB.push(evt);
      });

      // Wait for async setup
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Publish message ONLY for tenantA
      const channelA = `rt:notifications:${TENANT_A}:${USER_X}`;
      mockSubEmitter.emit('message', channelA, JSON.stringify(VALID_PAYLOAD));

      // Wait 100ms for any possible propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(emittedForB).toHaveLength(0);
      sub.unsubscribe();
    });
  });

  describe('SC-02: heartbeat emission', () => {
    it('emits at least one heartbeat when interval elapses', async () => {
      vi.useFakeTimers();
      const config = makeConfig({ SSE_HEARTBEAT_INTERVAL_MS: 100 });
      const svc = makeRedisService(config);
      const { manager } = makeConnectionManager(config);
      const ctrl = new SseController(manager as any, svc as any, config as any);

      mockTenantId = TENANT_A;
      mockUserId = USER_X;

      const emitted: MessageEvent[] = [];
      const sub = ctrl.stream().subscribe((evt) => emitted.push(evt));

      // Flush promises for async setup
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      vi.advanceTimersByTime(350);
      await Promise.resolve();

      const heartbeats = emitted.filter((e) => (e as any).type === 'heartbeat');
      expect(heartbeats.length).toBeGreaterThanOrEqual(1);

      sub.unsubscribe();
      await svc.onModuleDestroy();
      vi.useRealTimers();
    });
  });

  describe('SC-07: cleanup on disconnect', () => {
    it('calls connectionManager.release when subscriber unsubscribes', async () => {
      mockTenantId = TENANT_A;
      mockUserId = USER_X;
      const releaseSpy = vi.spyOn(connectionManager, 'release');

      const sub = controller.stream().subscribe(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 50));

      sub.unsubscribe();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('SC-03: 503 when max connections exceeded', () => {
    it('throws HttpException 503 when instance limit reached', async () => {
      mockTenantId = TENANT_A;
      mockUserId = USER_X;

      // Set instance count to max
      (connectionManager as any).instanceCount = (connectionManager as any).maxConnections;

      let caughtError: unknown = null;
      await new Promise<void>((resolve) => {
        controller.stream().subscribe({
          error: (err) => {
            caughtError = err;
            resolve();
          },
          complete: resolve,
        });
      });

      expect(caughtError).toBeInstanceOf(HttpException);
      expect((caughtError as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe('SC-04: eviction of oldest connection', () => {
    it('evicts oldest when per-user limit reached', async () => {
      const OLD_CONN = '019756c0-0002-7000-8000-aaaaaaaaaaaa';
      mockRedis.zcard.mockResolvedValue(3); // at max (SSE_MAX_PER_USER=3)
      mockRedis.zrange.mockResolvedValue([OLD_CONN]);
      mockRedis.zrem.mockResolvedValue(1);

      const result = await connectionManager.checkAndRegister(TENANT_A, USER_X, 'new-conn');
      expect(result.evicted).toBe(OLD_CONN);
    });
  });

  describe('EC-06: malformed payload', () => {
    it('discards malformed payload without killing the Observable', async () => {
      mockTenantId = TENANT_A;
      mockUserId = USER_X;

      const emitted: MessageEvent[] = [];
      const sub = controller.stream().subscribe((evt) => {
        if ((evt as any).type !== 'heartbeat') emitted.push(evt);
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const channel = `rt:notifications:${TENANT_A}:${USER_X}`;
      // Malformed payload first
      mockSubEmitter.emit('message', channel, 'not-json');

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(emitted).toHaveLength(0);

      // Valid payload — Observer must still be alive
      mockSubEmitter.emit('message', channel, JSON.stringify(VALID_PAYLOAD));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(emitted).toHaveLength(1);

      sub.unsubscribe();
    });
  });

  describe('notificationId → id mapping (end-to-end)', () => {
    it('Redis payload has notificationId, SSE event has id (no notificationId)', async () => {
      mockTenantId = TENANT_A;
      mockUserId = USER_X;

      const emitted: MessageEvent[] = [];
      const sub = controller.stream().subscribe((evt) => {
        if ((evt as any).type !== 'heartbeat') emitted.push(evt);
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const channel = `rt:notifications:${TENANT_A}:${USER_X}`;
      mockSubEmitter.emit('message', channel, JSON.stringify(VALID_PAYLOAD));
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(emitted).toHaveLength(1);
      const parsed = JSON.parse((emitted[0] as any).data);
      expect(parsed.id).toBe(VALID_PAYLOAD.notificationId);
      expect(parsed.notificationId).toBeUndefined();

      sub.unsubscribe();
    });
  });
});
