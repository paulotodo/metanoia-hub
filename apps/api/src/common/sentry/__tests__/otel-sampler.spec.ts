import { describe, it, expect } from 'vitest';
import { buildOtelSampler } from '../otel-sampler';
import { ParentBasedSampler } from '@opentelemetry/sdk-trace-base';

describe('buildOtelSampler', () => {
  it('returns ParentBasedSampler in all cases', () => {
    const s = buildOtelSampler({ NODE_ENV: 'development' });
    expect(s).toBeInstanceOf(ParentBasedSampler);
  });

  it('uses 1.0 rate in development (no arg)', () => {
    const s = buildOtelSampler({ NODE_ENV: 'development' });
    // ParentBasedSampler.toString() format: "ParentBased{root=TraceIdRatioBased{1}...}"
    expect(s.toString()).toContain('TraceIdRatioBased{1}');
  });

  it('uses 0.1 rate in production (no arg)', () => {
    const s = buildOtelSampler({ NODE_ENV: 'production' });
    expect(s.toString()).toContain('TraceIdRatioBased{0.1}');
  });

  it('uses OTEL_TRACES_SAMPLER_ARG=0.5 override', () => {
    const s = buildOtelSampler({ NODE_ENV: 'production', OTEL_TRACES_SAMPLER_ARG: 0.5 });
    expect(s.toString()).toContain('TraceIdRatioBased{0.5}');
  });

  it('falls back to default when OTEL_TRACES_SAMPLER_ARG is invalid', () => {
    const s = buildOtelSampler({
      NODE_ENV: 'production',
      OTEL_TRACES_SAMPLER_ARG: 'not-a-number' as unknown as number,
    });
    // Falls back to prod default 0.1
    expect(s.toString()).toContain('TraceIdRatioBased{0.1}');
  });
});
