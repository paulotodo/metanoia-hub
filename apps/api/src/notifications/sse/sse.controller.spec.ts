import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { SseController } from './sse.controller';

// Mock getRequestContext
vi.mock('../../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: '019756c0-0002-7000-8000-000000000001',
    userId: '019756c0-0002-7000-8000-000000000002',
    requestId: 'req-001',
    correlationId: 'corr-001',
  })),
}));

// Mock uuidv7
vi.mock('uuidv7', () => ({
  uuidv7: vi.fn(() => '019756c0-0002-7000-8000-000000000099'),
}));

function makeMockConnectionManager() {
  return {
    checkAndRegister: vi.fn().mockResolvedValue({ evicted: null }),
    release: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockSseRedisService() {
  return {
    subscribe: vi.fn(() => new Subject<MessageEvent>().asObservable()),
  };
}

function makeMockConfig(heartbeatMs = 30000) {
  return {
    get: vi.fn(() => heartbeatMs),
  };
}

describe('SseController', () => {
  let controller: SseController;
  let mockConnectionManager: ReturnType<typeof makeMockConnectionManager>;
  let mockSseRedisService: ReturnType<typeof makeMockSseRedisService>;
  let mockConfig: ReturnType<typeof makeMockConfig>;

  beforeEach(() => {
    mockConnectionManager = makeMockConnectionManager();
    mockSseRedisService = makeMockSseRedisService();
    mockConfig = makeMockConfig();
    controller = new SseController(
      mockConnectionManager as any,
      mockSseRedisService as any,
      mockConfig as any,
    );
  });

  describe('SC-01: stream() returns Observable', () => {
    it('returns an Observable<MessageEvent>', () => {
      const result = controller.stream();
      expect(result).toBeInstanceOf(Observable);
    });
  });

  describe('SC-02: heartbeat emission', () => {
    it('emits heartbeat events at configured interval', async () => {
      vi.useFakeTimers();
      const heartbeatMs = 100;
      mockConfig = makeMockConfig(heartbeatMs);
      controller = new SseController(
        mockConnectionManager as any,
        mockSseRedisService as any,
        mockConfig as any,
      );

      const emitted: MessageEvent[] = [];
      const sub = controller.stream().subscribe((evt) => emitted.push(evt));

      // Wait for async setup
      await Promise.resolve();
      await Promise.resolve();

      // Advance timers by 350ms to get 3 heartbeats
      vi.advanceTimersByTime(350);

      expect(emitted.length).toBeGreaterThanOrEqual(3);
      const heartbeats = emitted.filter((e) => (e as any).type === 'heartbeat');
      expect(heartbeats.length).toBeGreaterThanOrEqual(3);

      sub.unsubscribe();
      vi.useRealTimers();
    });
  });

  describe('SC-03: 503 when checkAndRegister throws', () => {
    it('Observable errors when connection manager throws 503', async () => {
      mockConnectionManager.checkAndRegister.mockRejectedValue(
        new HttpException('Too many connections', HttpStatus.SERVICE_UNAVAILABLE),
      );
      controller = new SseController(
        mockConnectionManager as any,
        mockSseRedisService as any,
        mockConfig as any,
      );

      let caughtError: unknown = null;
      await new Promise<void>((resolve) => {
        controller.stream().subscribe({
          error: (err) => {
            caughtError = err;
            resolve();
          },
        });
      });

      expect(caughtError).toBeInstanceOf(HttpException);
      expect((caughtError as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });

  describe('SC-04: eviction logging when evicted connection exists', () => {
    it('logs when checkAndRegister returns evicted connectionId', async () => {
      const EVICTED = '019756c0-0002-7000-8000-000000000050';
      mockConnectionManager.checkAndRegister.mockResolvedValue({ evicted: EVICTED });

      const logSpy = vi.spyOn((controller as any).logger, 'log');
      const sub = controller.stream().subscribe(() => undefined);

      // Wait for async setup
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ evicted: EVICTED }),
        expect.stringContaining('evicted'),
      );

      sub.unsubscribe();
    });
  });

  describe('finalize(): release on disconnect (SC-07)', () => {
    it('calls connectionManager.release when Observable is unsubscribed', async () => {
      const sub = controller.stream().subscribe(() => undefined);

      // Wait for async setup
      await new Promise((resolve) => setTimeout(resolve, 50));

      sub.unsubscribe();

      // Allow async release to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockConnectionManager.release).toHaveBeenCalledWith(
        '019756c0-0002-7000-8000-000000000001',
        '019756c0-0002-7000-8000-000000000002',
        '019756c0-0002-7000-8000-000000000099',
      );
    });
  });
});
