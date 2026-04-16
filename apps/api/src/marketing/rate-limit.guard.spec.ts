import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { MarketingRateLimitGuard } from './rate-limit.guard';

function makeContext(ip = '1.1.1.1'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, socket: { remoteAddress: ip } }),
    }),
  } as unknown as ExecutionContext;
}

describe('MarketingRateLimitGuard', () => {
  let guard: MarketingRateLimitGuard;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T18:00:00Z'));
    guard = new MarketingRateLimitGuard();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to 5 requests per IP within the 60s window', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(guard.canActivate(makeContext('1.1.1.1'))).toBe(true);
    }
  });

  it('throws 429 on the 6th request within the window', () => {
    for (let i = 0; i < 5; i += 1) {
      guard.canActivate(makeContext('1.1.1.1'));
    }
    expect(() => guard.canActivate(makeContext('1.1.1.1'))).toThrow(
      HttpException,
    );
  });

  it('isolates buckets per IP', () => {
    for (let i = 0; i < 5; i += 1) {
      guard.canActivate(makeContext('1.1.1.1'));
    }
    expect(guard.canActivate(makeContext('2.2.2.2'))).toBe(true);
  });

  it('resets the bucket after the window expires', () => {
    for (let i = 0; i < 5; i += 1) {
      guard.canActivate(makeContext('1.1.1.1'));
    }
    vi.advanceTimersByTime(61_000);
    expect(guard.canActivate(makeContext('1.1.1.1'))).toBe(true);
  });
});
