/**
 * otel-span-filter.ts — Drop noisy/health-check spans (OWASP M1 + FR-07)
 *
 * Spec §FR-07, plan §3 rule 4, checklist CHK042.
 * Placed FIRST in the processor chain — cheapest to drop before enrichment.
 *
 * Drops:
 * - HTTP spans for /api/health* and /api/v1/admin/health* (high-frequency noise)
 * - DB spans with SELECT 1, SELECT version(), SET LOCAL app.current_tenant_id=...
 */

import type { Context } from '@opentelemetry/api';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { Span } from '@opentelemetry/sdk-trace-base';

/** Health check URL prefixes to drop (case-sensitive, forward-slash normalized) */
const HEALTH_URL_PREFIXES = ['/api/health', '/api/v1/admin/health'];

/** DB statements to drop — normalized to lowercase for comparison */
const NOISE_STATEMENTS_LOWER = new Set<string>([
  'select 1',
  'select version()',
]);

const SET_LOCAL_PREFIX = 'set local app.current_tenant_id';

/** Symbol used to mark a span for dropping */
const DROP_MARKER = Symbol('otel.drop');

function isHealthUrl(url: string | undefined): boolean {
  if (!url) return false;
  return HEALTH_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function isNoiseStatement(stmt: string | undefined): boolean {
  if (!stmt) return false;
  const normalized = stmt.trim().toLowerCase();
  if (NOISE_STATEMENTS_LOWER.has(normalized)) return true;
  if (normalized.startsWith(SET_LOCAL_PREFIX)) return true;
  return false;
}

/**
 * First-in-chain processor that marks noisy spans for dropping.
 * onStart: mark for drop (prevents span from recording).
 * onEnd: skip forwarding dropped spans.
 */
export class OtelSpanFilter implements SpanProcessor {
  constructor(private readonly _next: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    // Check HTTP URL attributes at start time
    const attrs = span.attributes as Record<string, unknown>;
    const httpUrl = (attrs['http.url'] ?? attrs['http.target']) as string | undefined;

    if (isHealthUrl(httpUrl)) {
      (span as unknown as Record<symbol, boolean>)[DROP_MARKER] = true;
      return; // don't forward to next — stop recording
    }

    // Check DB statement at start
    const dbStmt = attrs['db.statement'] as string | undefined;
    if (isNoiseStatement(dbStmt)) {
      (span as unknown as Record<symbol, boolean>)[DROP_MARKER] = true;
      return;
    }

    this._next.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    // Check drop marker
    if ((span as unknown as Record<symbol, boolean>)[DROP_MARKER]) {
      return; // silently discard
    }

    // Also check at end for late-set attributes
    const attrs = span.attributes as Record<string, unknown>;
    const httpUrl = (attrs['http.url'] ?? attrs['http.target']) as string | undefined;
    const dbStmt = attrs['db.statement'] as string | undefined;

    if (isHealthUrl(httpUrl) || isNoiseStatement(dbStmt)) {
      return; // discard
    }

    this._next.onEnd(span);
  }

  async shutdown(): Promise<void> {
    return this._next.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this._next.forceFlush();
  }
}
