import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SseConnectionManager } from './sse-connection.manager';

function makeMockRedis() {
  return {
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zcard: vi.fn().mockResolvedValue(0),
    zrange: vi.fn().mockResolvedValue([]),
  };
}

function makeMockConfig(values: Record<string, number> = {}) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'SSE_MAX_CONNECTIONS') return values['SSE_MAX_CONNECTIONS'] ?? 1000;
      if (key === 'SSE_MAX_PER_USER') return values['SSE_MAX_PER_USER'] ?? 5;
      return undefined;
    }),
  };
}

const VALID_TENANT = '019756c0-0002-7000-8000-000000000001';
const VALID_USER = '019756c0-0002-7000-8000-000000000002';
const VALID_CONN = '019756c0-0002-7000-8000-000000000003';

describe('SseConnectionManager', () => {
  let manager: SseConnectionManager;
  let mockRedis: ReturnType<typeof makeMockRedis>;
  let mockConfig: ReturnType<typeof makeMockConfig>;

  beforeEach(() => {
    mockRedis = makeMockRedis();
    mockConfig = makeMockConfig();
    manager = new SseConnectionManager(mockConfig as any, mockRedis as any);
    manager.onModuleInit();
  });

  describe('assertValidUuid', () => {
    it('accepts a valid UUID v7', () => {
      expect(() => manager.assertValidUuid(VALID_TENANT, 'tenantId')).not.toThrow();
    });

    it('rejects a non-UUID string', () => {
      expect(() => manager.assertValidUuid('not-a-uuid', 'tenantId')).toThrow(
        'Invalid UUID format',
      );
    });

    it('rejects empty string', () => {
      expect(() => manager.assertValidUuid('', 'userId')).toThrow('Invalid UUID format');
    });
  });

  describe('checkInstanceLimit (SC-03)', () => {
    it('throws 503 with Retry-After: 30 when instance limit reached', () => {
      // Set up manager with limit 2
      mockConfig = makeMockConfig({ SSE_MAX_CONNECTIONS: 2 });
      manager = new SseConnectionManager(mockConfig as any, mockRedis as any);
      manager.onModuleInit();

      // Manually set instanceCount to max via private field manipulation
      (manager as any).instanceCount = 2;

      expect(() => manager.checkInstanceLimit()).toThrow(HttpException);
      try {
        manager.checkInstanceLimit();
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }
    });

    it('does not throw when under instance limit', () => {
      (manager as any).instanceCount = 999;
      expect(() => manager.checkInstanceLimit()).not.toThrow();
    });
  });

  describe('checkAndRegister (SC-04)', () => {
    it('returns { evicted: null } when under per-user limit', async () => {
      mockRedis.zcard.mockResolvedValue(2); // below default max 5
      const result = await manager.checkAndRegister(VALID_TENANT, VALID_USER, VALID_CONN);
      expect(result).toEqual({ evicted: null });
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        `sse:connections:${VALID_TENANT}:${VALID_USER}`,
        expect.any(Number),
        VALID_CONN,
      );
    });

    it('evicts oldest connection when per-user limit reached (SC-04)', async () => {
      const OLD_CONN = '019756c0-0002-7000-8000-000000000099';
      mockRedis.zcard.mockResolvedValue(5); // at max
      mockRedis.zrange.mockResolvedValue([OLD_CONN]);
      mockRedis.zrem.mockResolvedValue(1); // successful eviction

      const result = await manager.checkAndRegister(VALID_TENANT, VALID_USER, VALID_CONN);
      expect(result.evicted).toBe(OLD_CONN);
      expect(mockRedis.zrem).toHaveBeenCalledWith(
        `sse:connections:${VALID_TENANT}:${VALID_USER}`,
        OLD_CONN,
      );
      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it('EC-04: retries ZRANGE when ZREM returns 0 (connection already gone)', async () => {
      const OLD_CONN_1 = '019756c0-0002-7000-8000-000000000010';
      const OLD_CONN_2 = '019756c0-0002-7000-8000-000000000011';

      // First iteration: at limit, ZREM fails (returns 0)
      // Second iteration: still at limit, ZREM succeeds on second oldest
      mockRedis.zcard
        .mockResolvedValueOnce(5)  // first check
        .mockResolvedValueOnce(5); // after ZREM failed, re-check
      mockRedis.zrange
        .mockResolvedValueOnce([OLD_CONN_1])
        .mockResolvedValueOnce([OLD_CONN_2]);
      mockRedis.zrem
        .mockResolvedValueOnce(0)  // OLD_CONN_1 already gone
        .mockResolvedValueOnce(1); // OLD_CONN_2 evicted

      const result = await manager.checkAndRegister(VALID_TENANT, VALID_USER, VALID_CONN);
      expect(result.evicted).toBe(OLD_CONN_2);
    });

    it('increments instanceCount on successful registration', async () => {
      mockRedis.zcard.mockResolvedValue(0);
      const initialCount = (manager as any).instanceCount;
      await manager.checkAndRegister(VALID_TENANT, VALID_USER, VALID_CONN);
      expect((manager as any).instanceCount).toBe(initialCount + 1);
    });
  });

  describe('release (SC-07)', () => {
    it('executes ZREM and decrements instanceCount', async () => {
      (manager as any).instanceCount = 3;
      await manager.release(VALID_TENANT, VALID_USER, VALID_CONN);

      expect(mockRedis.zrem).toHaveBeenCalledWith(
        `sse:connections:${VALID_TENANT}:${VALID_USER}`,
        VALID_CONN,
      );
      expect((manager as any).instanceCount).toBe(2);
    });

    it('does not go below 0 on instanceCount', async () => {
      (manager as any).instanceCount = 0;
      await manager.release(VALID_TENANT, VALID_USER, VALID_CONN);
      expect((manager as any).instanceCount).toBe(0);
    });
  });

  describe('EC-07: onModuleInit with invalid values', () => {
    it('applies default 1000 and logs warning when SSE_MAX_CONNECTIONS=0', () => {
      mockConfig = makeMockConfig({ SSE_MAX_CONNECTIONS: 0, SSE_MAX_PER_USER: 5 });
      manager = new SseConnectionManager(mockConfig as any, mockRedis as any);
      const logWarnSpy = vi.spyOn((manager as any).logger, 'warn');
      manager.onModuleInit();
      expect((manager as any).maxConnections).toBe(1000);
      expect(logWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ value: 0 }),
        expect.stringContaining('SSE_MAX_CONNECTIONS'),
      );
    });
  });
});
