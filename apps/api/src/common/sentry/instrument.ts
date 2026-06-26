/**
 * instrument.ts — Sentry + OpenTelemetry initialization preload (NFR-O5)
 *
 * Decision D-01 (plan §0): Sentry v10 creates a single TracerProvider internally.
 * We register our custom SpanProcessors via `openTelemetrySpanProcessors` option —
 * DO NOT install @opentelemetry/sdk-node or @opentelemetry/auto-instrumentations-node
 * (they would create a second provider and duplicate HTTP/Express spans).
 *
 * Processor chain order (left = first in array = executes first):
 *   1. OtelSpanFilter        — drop health/noise spans cheaply (OWASP M1, FR-07)
 *   2. ContextSpanProcessor  — add tenant.id/user.id/correlation_id (FR-06)
 *   3. OtelAllowlistProcessor — deny-by-default scrub (OWASP M2)
 *   4. BatchSpanProcessor    — buffer + export to OTLP backend
 *
 * No-op mode: when OTEL_EXPORTER_OTLP_ENDPOINT is absent, processors 1–4 are
 * omitted; Sentry.init() behaves identically to pre-tracing behavior (FR-01/02).
 *
 * Sampling: Sentry v10 uses tracesSampleRate / tracesSampler (Sentry-style function).
 * OTel-level sampling via ParentBasedSampler is handled transparently by Sentry's
 * SentrySampler under the hood. We use Sentry's tracesSampleRate for simplicity.
 */

import * as Sentry from '@sentry/nestjs';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { parseTracesSampleRate } from './parse-traces-sample-rate';
import { resolveOtelConfig } from './otel-config';
import { buildOtelResource } from './otel-resource';
import { OtelSpanFilter } from './otel-span-filter';
import { ContextSpanProcessor } from './context-span-processor';
import { OtelAllowlistProcessor } from './otel-allowlist-processor';

function buildProcessorChain(): SpanProcessor[] {
  const config = resolveOtelConfig();

  if (config.mode === 'noop') {
    return [];
  }

  // The terminal exporter that ships data
  let terminalProcessor: SpanProcessor;

  if (config.mode === 'console') {
    // Non-production only (production check is inside resolveOtelConfig — CHK047)
    terminalProcessor = new SimpleSpanProcessor(new ConsoleSpanExporter());
  } else {
    // otlp mode
    const exporter = new OTLPTraceExporter({ url: config.endpoint });
    terminalProcessor = new BatchSpanProcessor(exporter, {
      // Decision CHK054: maxQueueSize=2048 (default OTel), overflow = silent drop (fail-safe)
      // Documented in runbook.md §8 and plan.md §2.
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5_000,
    });
  }

  // Chain: filter → context → allowlist → terminal
  const allowlistProcessor = new OtelAllowlistProcessor(terminalProcessor);
  const contextProcessor = new ContextSpanProcessor(allowlistProcessor);
  const filterProcessor = new OtelSpanFilter(contextProcessor);

  return [filterProcessor];
}

const otelProcessors = buildProcessorChain();

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: parseTracesSampleRate(),
  // OpenTelemetry: only active when OTEL mode is not 'noop'
  ...(otelProcessors.length > 0
    ? {
        // Resource identifies this service in trace backends (service.name, version, env)
        resource: buildOtelResource(),
        // Custom SpanProcessor chain (filter → context → allowlist → export)
        openTelemetrySpanProcessors: otelProcessors,
      }
    : {}),
});
