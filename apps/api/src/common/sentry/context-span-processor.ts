/**
 * context-span-processor.ts — Enrich spans with request context (FR-03, FR-06, FR-13)
 *
 * Spec §FR-03, FR-06, FR-13, plan §4, checklist CHK006/CHK016.
 * Applies tenant.id, user.id, correlation_id to 100% of spans.
 *
 * SECURITY (OWASP M4 / CHK046):
 * - user.id MUST be the Keycloak `sub` field (UUID), never email or display name.
 *   The `userId` field in RequestContext is set by JwtAuthGuard from `payload.sub`.
 * - tenant.id is the tenant UUID from the JWT claim, never a human-readable name.
 * - Attributes not in the allowlist are scrubbed by OtelAllowlistProcessor downstream.
 *
 * Defensive: fora de request (worker threads, startup code) → no-op silencioso.
 */

import type { Context } from '@opentelemetry/api';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import type { Span } from '@opentelemetry/sdk-trace-base';
import { getRequestContext } from '../context/request-context';

export class ContextSpanProcessor implements SpanProcessor {
  constructor(private readonly _next: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    try {
      const ctx = getRequestContext();
      // FR-06: tenant.id on 100% of authenticated spans
      span.setAttribute('tenant.id', ctx.tenantId);
      // FR-03: correlation_id for distributed tracing
      span.setAttribute('correlation_id', ctx.correlationId);
      // FR-03: user.id when authenticated (sub from Keycloak JWT — never email/name)
      if (ctx.userId) {
        span.setAttribute('user.id', ctx.userId);
      }
    } catch {
      // Outside request context (e.g., startup, worker, health) — silent no-op.
      // Never throw from a SpanProcessor — would crash instrumentation.
    }
    this._next.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    this._next.onEnd(span);
  }

  async shutdown(): Promise<void> {
    return this._next.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this._next.forceFlush();
  }
}
