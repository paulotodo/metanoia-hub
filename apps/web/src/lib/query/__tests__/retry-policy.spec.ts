import { describe, it, expect } from 'vitest';
import {
  shouldRetryQuery,
  exponentialRetryDelay,
  RETRY_POLICY,
} from '../retry-policy';
import { ApiError } from '../../api/client';

describe('shouldRetryQuery', () => {
  it('caps at 3 attempts (0, 1, 2 retried; 3 stops)', () => {
    expect(shouldRetryQuery(0, new Error('net'))).toBe(true);
    expect(shouldRetryQuery(1, new Error('net'))).toBe(true);
    expect(shouldRetryQuery(2, new Error('net'))).toBe(true);
    expect(shouldRetryQuery(3, new Error('net'))).toBe(false);
  });

  it('does NOT retry deterministic 4xx ApiErrors', () => {
    expect(shouldRetryQuery(0, new ApiError(400, 'BadRequest', 'x'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(401, 'Unauthorized', 'x'))).toBe(
      false,
    );
    expect(shouldRetryQuery(0, new ApiError(403, 'Forbidden', 'x'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(404, 'NotFound', 'x'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(422, 'Unprocessable', 'x'))).toBe(
      false,
    );
  });

  it('retries transient 4xx ApiErrors (408, 425, 429)', () => {
    expect(shouldRetryQuery(0, new ApiError(408, 'Timeout', 'x'))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(425, 'TooEarly', 'x'))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(429, 'TooManyRequests', 'x'))).toBe(
      true,
    );
  });

  it('retries 5xx ApiErrors', () => {
    expect(shouldRetryQuery(0, new ApiError(500, 'Internal', 'x'))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(502, 'BadGateway', 'x'))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(503, 'Unavailable', 'x'))).toBe(
      true,
    );
  });

  it('retries TypeError (fetch network failures)', () => {
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
  });
});

describe('exponentialRetryDelay', () => {
  it('returns 1s, 2s, 4s for attempts 0, 1, 2', () => {
    expect(exponentialRetryDelay(0)).toBe(1_000);
    expect(exponentialRetryDelay(1)).toBe(2_000);
    expect(exponentialRetryDelay(2)).toBe(4_000);
  });

  it('caps at 4s for attempts >= 2', () => {
    expect(exponentialRetryDelay(3)).toBe(4_000);
    expect(exponentialRetryDelay(10)).toBe(4_000);
  });
});

describe('RETRY_POLICY', () => {
  it('exposes maxRetries=3 for visibility', () => {
    expect(RETRY_POLICY.maxRetries).toBe(3);
  });
});
