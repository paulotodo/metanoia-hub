import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff } from '../../prisma/seeds/_retry';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns value on first attempt without sleeping', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => 'ok');

    const result = await retryWithBackoff(fn, { sleep });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries until success and returns the eventual value', async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 2) throw new Error('transient');
      return 'ok';
    });

    const result = await retryWithBackoff(fn, { sleep, baseMs: 100 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('throws the last error after exhausting attempts', async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      throw new Error(`fail ${calls}`);
    });

    await expect(
      retryWithBackoff(fn, { sleep, attempts: 3, baseMs: 10 }),
    ).rejects.toThrow('fail 3');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('uses exponential backoff baseMs * 2^(attempt-1)', async () => {
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(
      retryWithBackoff(fn, { sleep, attempts: 4, baseMs: 500 }),
    ).rejects.toThrow('boom');

    expect(delays).toEqual([500, 1000, 2000]);
  });
});
