import { describe, it, expect, vi } from 'vitest';
import { resolveOtelConfig } from '../otel-config';

describe('resolveOtelConfig', () => {
  it('returns noop when OTEL_TRACES_EXPORTER=none', () => {
    expect(resolveOtelConfig({ OTEL_TRACES_EXPORTER: 'none' })).toEqual({ mode: 'noop' });
  });

  it('returns noop when OTEL_TRACES_EXPORTER=otlp and endpoint absent', () => {
    expect(resolveOtelConfig({ OTEL_TRACES_EXPORTER: 'otlp' })).toEqual({ mode: 'noop' });
  });

  it('returns noop when endpoint is empty (docker-compose empty string)', () => {
    // Zod already converts '' to undefined, but test pure function defensively
    expect(resolveOtelConfig({ OTEL_TRACES_EXPORTER: 'otlp', OTEL_EXPORTER_OTLP_ENDPOINT: '' })).toEqual({
      mode: 'noop',
    });
  });

  it('returns otlp when endpoint is present', () => {
    const result = resolveOtelConfig({
      OTEL_TRACES_EXPORTER: 'otlp',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    });
    expect(result).toEqual({ mode: 'otlp', endpoint: 'http://localhost:4318' });
  });

  it('returns console in development', () => {
    const result = resolveOtelConfig({
      OTEL_TRACES_EXPORTER: 'console',
      NODE_ENV: 'development',
    });
    expect(result).toEqual({ mode: 'console' });
  });

  it('returns noop and warns when console in production (CHK047)', () => {
    const warn = vi.fn();
    const result = resolveOtelConfig({ OTEL_TRACES_EXPORTER: 'console', NODE_ENV: 'production' }, warn);
    expect(result).toEqual({ mode: 'noop' });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/console exporter/i);
  });

  it('defaults to otlp when OTEL_TRACES_EXPORTER absent + endpoint present', () => {
    const result = resolveOtelConfig({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://col:4318' });
    expect(result).toEqual({ mode: 'otlp', endpoint: 'http://col:4318' });
  });
});
