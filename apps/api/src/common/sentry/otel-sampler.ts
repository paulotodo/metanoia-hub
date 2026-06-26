/**
 * otel-sampler.ts — OTel sampler factory (NFR-O5 / plan §2)
 *
 * Default rates (plan §2):
 *   - production:     0.1  (10% of traces)
 *   - non-production: 1.0  (100% of traces)
 * Override via OTEL_TRACES_SAMPLER_ARG (0..1 float, validated by Zod schema).
 *
 * Uses ParentBasedSampler to ensure trace coherence: if a parent span is sampled,
 * all child spans are also sampled (and vice versa), preventing broken traces.
 */

import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import type { Sampler } from '@opentelemetry/sdk-trace-base';

const PROD_RATE = 0.1;
const DEV_RATE = 1.0;

export interface OtelSamplerEnv {
  OTEL_TRACES_SAMPLER_ARG?: string | number;
  NODE_ENV?: string;
}

/**
 * Build a ParentBasedSampler with TraceIdRatioBasedSampler root.
 * Rate resolution priority:
 *   1. OTEL_TRACES_SAMPLER_ARG (already validated 0..1 by Zod)
 *   2. NODE_ENV-based default
 */
export function buildOtelSampler(env: OtelSamplerEnv = process.env): Sampler {
  const isProd = (env.NODE_ENV ?? 'development') === 'production';

  let rate: number;
  const rawArg = env.OTEL_TRACES_SAMPLER_ARG;
  if (rawArg !== undefined && rawArg !== '') {
    const parsed = Number(rawArg);
    rate = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
      ? parsed
      : (isProd ? PROD_RATE : DEV_RATE);
  } else {
    rate = isProd ? PROD_RATE : DEV_RATE;
  }

  return new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(rate),
  });
}
