/**
 * bullmq-tracing.ts — BullMQ trace context propagation (FR-12)
 *
 * Spec §FR-12, plan §6, checklist CHK037/CHK038, OWASP M3/M4.
 *
 * Two functions:
 *   - injectTraceContext: called when enqueuing a job (producer side)
 *     Injects W3C traceparent + tenantId into job data._traceContext
 *   - runWithExtractedContext: called in job processor (consumer side)
 *     Extracts trace context, validates traceparent, re-establishes RequestContext,
 *     creates consumer span, runs the processor.
 *
 * OWASP M3: traceparent validated before propagation.extract()
 * OWASP M4: tenantId propagated and re-established in worker to ensure
 *            ContextSpanProcessor finds tenant.id on all worker spans.
 */

import {
  context,
  propagation,
  trace,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';
import { requestContext } from '../common/context/request-context';
import { validateTraceparent } from '../common/sentry/validate-traceparent';

/** Shape injected into job data by the producer */
export interface TraceContextPayload {
  traceparent?: string;
  tracestate?: string;
  /** tenantId from RequestContext at enqueue time (OWASP M4: mandatory) */
  tenantId?: string;
}

/** Job data enriched with trace context */
export type WithTraceContext<T extends object> = T & {
  _traceContext: TraceContextPayload;
};

/** Metadata about the BullMQ job being processed */
export interface JobMeta {
  queueName: string;
  jobName: string;
  jobId: string;
  attemptsMade: number;
}

const TRACER_NAME = 'bullmq';

/**
 * Inject current trace context into job data (producer side).
 * Called before Queue.add() to carry W3C trace context and tenantId across
 * the async job boundary.
 *
 * @param data - original job data
 * @returns enriched job data with _traceContext field
 */
export function injectTraceContext<T extends object>(
  data: T,
): WithTraceContext<T> {
  // Extract W3C traceparent/tracestate from current active context
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  // Extract tenantId from current RequestContext (OWASP M4: mandatory)
  let tenantId: string | undefined;
  try {
    const ctx = requestContext.getStore();
    tenantId = ctx?.tenantId;
  } catch {
    // Outside request context — no tenantId available (fallback in worker)
  }

  const traceCtx: TraceContextPayload = {
    ...(carrier['traceparent'] ? { traceparent: carrier['traceparent'] } : {}),
    ...(carrier['tracestate'] ? { tracestate: carrier['tracestate'] } : {}),
    ...(tenantId ? { tenantId } : {}),
  };

  return {
    ...data,
    _traceContext: traceCtx,
  };
}

/**
 * Extract trace context from job data and run processor within that context (consumer side).
 * Called by the BullMQ worker wrapper.
 *
 * OWASP M3: validates traceparent before extract
 * OWASP M4: re-establishes RequestContext with propagated tenantId
 *
 * @param jobData - job data (may contain _traceContext)
 * @param meta    - job metadata for span attributes
 * @param fn      - the actual processor function to run
 */
export async function runWithExtractedContext<R>(
  jobData: unknown,
  meta: JobMeta,
  fn: () => Promise<R>,
): Promise<R> {
  const tracer = trace.getTracer(TRACER_NAME);

  // Extract _traceContext from job data (may be absent for jobs enqueued before instrumentation)
  const tc = (jobData as Record<string, unknown>)?._traceContext as
    | TraceContextPayload
    | undefined;

  // CHK038: fallback when _traceContext absent — root span fresh, no error
  let parentCtx = context.active();

  if (tc?.traceparent) {
    // OWASP M3: validate BEFORE propagation.extract()
    if (validateTraceparent(tc.traceparent)) {
      const carrier: Record<string, string> = {
        traceparent: tc.traceparent,
        ...(tc.tracestate ? { tracestate: tc.tracestate } : {}),
      };
      parentCtx = propagation.extract(context.active(), carrier);
    }
    // else: invalid traceparent → parentCtx = root span fresh (already set above)
  }
  // else: no _traceContext (pre-instrumentation job) → root span fresh

  // OWASP M4: re-establish RequestContext in worker with propagated tenantId
  // This ensures ContextSpanProcessor.onStart finds tenant.id on all worker spans.
  const tenantId = tc?.tenantId ?? 'unknown'; // explicit unknown if not propagated

  return new Promise<R>((resolve, reject) => {
    // Run within extracted parent context
    context.with(parentCtx, () => {
      tracer.startActiveSpan(
        `bullmq.process ${meta.queueName}`,
        {
          kind: SpanKind.CONSUMER,
          attributes: {
            'job.name': meta.jobName,
            'job.id': meta.jobId,
            'job.attemptsMade': meta.attemptsMade,
            'queue.name': meta.queueName,
            'tenant.id': tenantId,
          },
        },
        async (span) => {
          // Re-establish RequestContext for this async context
          requestContext.run(
            {
              tenantId,
              requestId: meta.jobId,
              correlationId: `job:${meta.jobId}`,
              userId: undefined,
            },
            async () => {
              try {
                const result = await fn();
                resolve(result);
              } catch (err) {
                span.setStatus({ code: SpanStatusCode.ERROR });
                if (err instanceof Error) {
                  span.recordException(err);
                }
                reject(err);
              } finally {
                span.end();
              }
            },
          );
        },
      );
    });
  });
}
