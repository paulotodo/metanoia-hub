/**
 * Unit tests for CheckEmailsRateLimitGuard (task 1.1, Story 10-3).
 *
 * Covers: within limit (pass), exceed limit (429), tenant isolation,
 * window reset after 60s, IP fallback when context unavailable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExecutionContext, HttpException } from '@nestjs/common';
import {
  CheckEmailsRateLimitGuard,
  MAX_REQUESTS,
  WINDOW_MS,
} from './check-emails-rate-limit.guard';

// Mock getRequestContext
vi.mock('../common/context/request-context', () => ({
  getRequestContext: vi.fn(),
}));

import { getRequestContext } from '../common/context/request-context';

const mockGetRequestContext = getRequestContext as ReturnType<typeof vi.fn>;

function makeCtx(options: { ip?: string } = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip: options.ip ?? '127.0.0.1',
        socket: { remoteAddress: options.ip ?? '127.0.0.1' },
      }),
    }),
  } as unknown as ExecutionContext;
}

function mockContext(tenantId: string) {
  mockGetRequestContext.mockReturnValue({
    tenantId,
    userId: 'user-1',
    requestId: 'req-1',
    correlationId: 'corr-1',
  });
}

describe('CheckEmailsRateLimitGuard', () => {
  let guard: CheckEmailsRateLimitGuard;

  beforeEach(() => {
    guard = new CheckEmailsRateLimitGuard();
    vi.useFakeTimers();
  });

  afterEach(() => {
    guard._clearBuckets();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('within rate limit', () => {
    it('allows requests up to MAX_REQUESTS per window', () => {
      mockContext('tenant-a');
      const ctx = makeCtx();

      for (let i = 0; i < MAX_REQUESTS; i++) {
        expect(guard.canActivate(ctx)).toBe(true);
      }
    });
  });

  describe('exceeding rate limit', () => {
    it('throws HttpException when MAX_REQUESTS + 1 is reached', () => {
      mockContext('tenant-b');
      const ctx = makeCtx();

      for (let i = 0; i < MAX_REQUESTS; i++) {
        guard.canActivate(ctx);
      }

      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    });

    it('429 response has correct statusCode and error shape', () => {
      mockContext('tenant-c');
      const ctx = makeCtx();

      for (let i = 0; i < MAX_REQUESTS; i++) {
        guard.canActivate(ctx);
      }

      let error: HttpException | undefined;
      try {
        guard.canActivate(ctx);
      } catch (e) {
        error = e as HttpException;
      }

      expect(error).toBeDefined();
      const response = error!.getResponse() as {
        statusCode: number;
        error: string;
        message: string;
      };
      expect(response.statusCode).toBe(429);
      expect(response.error).toBe('Too Many Requests');
      expect(typeof response.message).toBe('string');
    });
  });

  describe('tenant isolation', () => {
    it('tenant A exhausting limit does not affect tenant B', () => {
      const ctx = makeCtx();

      // Exhaust tenant A
      mockContext('tenant-iso-a');
      for (let i = 0; i < MAX_REQUESTS; i++) {
        guard.canActivate(ctx);
      }
      expect(() => guard.canActivate(ctx)).toThrow();

      // Tenant B should still pass
      mockContext('tenant-iso-b');
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('window reset', () => {
    it('allows requests again after WINDOW_MS elapses', () => {
      mockContext('tenant-reset');
      const ctx = makeCtx();

      // Exhaust limit
      for (let i = 0; i < MAX_REQUESTS; i++) {
        guard.canActivate(ctx);
      }
      expect(() => guard.canActivate(ctx)).toThrow();

      // Advance past window
      vi.advanceTimersByTime(WINDOW_MS + 100);

      // Should pass again
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('IP fallback', () => {
    it('uses IP as key when getRequestContext throws', () => {
      mockGetRequestContext.mockImplementation(() => {
        throw new Error('RequestContext not initialized');
      });

      const ctx = makeCtx({ ip: '10.0.0.1' });
      // Must not throw — fallback to IP
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
