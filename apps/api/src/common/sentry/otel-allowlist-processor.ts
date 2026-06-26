/**
 * otel-allowlist-processor.ts — Deny-by-default span attribute allowlist (OWASP M2)
 *
 * Checklist CHK043. Implements SpanProcessor that removes any span attribute
 * NOT in the explicit allowlist before delegating to the next processor.
 *
 * Placement in chain: AFTER ContextSpanProcessor (which adds context attrs),
 * BEFORE BatchSpanProcessor (which exports to backend).
 * This guarantees scrubbing happens before any data leaves the process.
 */

import type { Context } from '@opentelemetry/api';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { Span } from '@opentelemetry/sdk-trace-base';

/**
 * Allowlist of span attribute keys permitted to be exported.
 * Deny-by-default: any key not in this set is removed in onEnd.
 */
export const SPAN_ATTRIBUTE_ALLOWLIST = new Set<string>([
  // HTTP
  'http.method',
  'http.url',
  'http.status_code',
  'http.target',
  // DB
  'db.system',
  'db.operation',
  'db.statement',
  'db.name',
  // Identity (tenant/user — always subject/UUID, never PII per OWASP M4/CHK046)
  'user.id',
  'tenant.id',
  'correlation_id',
  // BullMQ job
  'job.name',
  'job.id',
  'job.attemptsMade',
  'queue.name',
  // Next.js
  'next.route',
  'next.rsc',
  // Span metadata
  'span.kind',
  // Exception events (on span events, not attributes — included for completeness)
  'exception.type',
  'exception.message',
  'exception.stacktrace',
  // OTel status
  'otel.status_code',
  'otel.status_description',
  // Resource (service identity — set at resource level, not span level)
  'service.name',
  'service.version',
  'deployment.environment',
]);

/**
 * URL-valued attributes whose query string must be stripped before export
 * (OWASP M2): a query string may carry tokens, emails, or other PII.
 */
const URL_ATTRIBUTES_TO_STRIP_QUERY = ['http.url'] as const;

/**
 * Scrub span attributes not in the allowlist.
 * Operates on the mutable span in onEnd (after all processors have enriched it).
 */
export class OtelAllowlistProcessor implements SpanProcessor {
  constructor(private readonly _next: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    this._next.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    // Span attributes are a plain object — iterate and remove non-allowlisted keys.
    // ReadableSpan.attributes is readonly in types but mutable at runtime.
    // Use Reflect.deleteProperty to avoid @typescript-eslint/no-dynamic-delete.
    const attrs = span.attributes as Record<string, unknown>;
    for (const key of Object.keys(attrs)) {
      if (!SPAN_ATTRIBUTE_ALLOWLIST.has(key)) {
        Reflect.deleteProperty(attrs, key);
      }
    }
    // OWASP M2: even allowlisted URL attributes must have their query string
    // stripped — query params can carry tokens/emails (PII) that would leak
    // verbatim into the tracing backend.
    for (const key of URL_ATTRIBUTES_TO_STRIP_QUERY) {
      const value = attrs[key];
      if (typeof value === 'string') {
        const queryStart = value.indexOf('?');
        if (queryStart !== -1) {
          attrs[key] = value.slice(0, queryStart);
        }
      }
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
