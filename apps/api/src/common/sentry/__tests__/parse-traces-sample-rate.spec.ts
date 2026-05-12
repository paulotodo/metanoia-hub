import { describe, it, expect, vi } from 'vitest';
import { parseTracesSampleRate } from '../parse-traces-sample-rate';

describe('parseTracesSampleRate', () => {
  it('returns 0.2 default in production when env is not set', () => {
    const warn = vi.fn();
    expect(
      parseTracesSampleRate({ NODE_ENV: 'production' }, warn),
    ).toBe(0.2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns 1.0 default in non-production when env is not set', () => {
    const warn = vi.fn();
    expect(
      parseTracesSampleRate({ NODE_ENV: 'development' }, warn),
    ).toBe(1.0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('parses a valid env value in range', () => {
    const warn = vi.fn();
    expect(
      parseTracesSampleRate(
        { NODE_ENV: 'production', SENTRY_TRACES_SAMPLE_RATE: '0.5' },
        warn,
      ),
    ).toBe(0.5);
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts boundary values 0 and 1', () => {
    expect(
      parseTracesSampleRate({ NODE_ENV: 'production', SENTRY_TRACES_SAMPLE_RATE: '0' }, vi.fn()),
    ).toBe(0);
    expect(
      parseTracesSampleRate({ NODE_ENV: 'production', SENTRY_TRACES_SAMPLE_RATE: '1' }, vi.fn()),
    ).toBe(1);
  });

  it('falls back and warns on non-numeric env', () => {
    const warn = vi.fn();
    expect(
      parseTracesSampleRate(
        { NODE_ENV: 'production', SENTRY_TRACES_SAMPLE_RATE: 'abc' },
        warn,
      ),
    ).toBe(0.2);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/Invalid SENTRY_TRACES_SAMPLE_RATE/);
  });

  it('falls back and warns on value above 1', () => {
    const warn = vi.fn();
    expect(
      parseTracesSampleRate(
        { NODE_ENV: 'development', SENTRY_TRACES_SAMPLE_RATE: '1.5' },
        warn,
      ),
    ).toBe(1.0);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('falls back and warns on negative value', () => {
    const warn = vi.fn();
    expect(
      parseTracesSampleRate(
        { NODE_ENV: 'production', SENTRY_TRACES_SAMPLE_RATE: '-0.1' },
        warn,
      ),
    ).toBe(0.2);
    expect(warn).toHaveBeenCalledOnce();
  });
});
