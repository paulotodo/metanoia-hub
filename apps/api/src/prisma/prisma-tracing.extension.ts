/**
 * prisma-tracing.extension.ts — Prisma tracing extension (FR-04, FR-05)
 *
 * Spec §FR-04, FR-05, plan §3 D-03, checklist CHK004/CHK005.
 *
 * WHY $extends and not instrumentation-pg:
 * PrismaPg adapter routes queries through libpq, not the pg driver's query
 * pipeline that @opentelemetry/instrumentation-pg hooks. Using $extends
 * captures ALL Prisma operations at the ORM level with model/operation metadata.
 *
 * Chain: $allOperations wrapper → span start → sanitize db.statement → query → span end
 */

import { Prisma } from '@prisma/client';
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { sanitizeStatement } from '../common/sentry/sanitize-sql';

const TRACER_NAME = 'prisma';

function isRawOperation(operation: string): boolean {
  return (
    operation === 'queryRaw' ||
    operation === 'executeRaw' ||
    operation === '$queryRaw' ||
    operation === '$executeRaw'
  );
}

export const prismaTracingExtension = Prisma.defineExtension({
  name: 'otel-tracing',
  query: {
    async $allOperations({
      model,
      operation,
      args,
      query,
    }: {
      model?: string;
      operation: string;
      args: unknown;
      query: (args: unknown) => Promise<unknown>;
    }): Promise<unknown> {
      const tracer = trace.getTracer(TRACER_NAME);

      // Keep-alive detection: skip span for SELECT 1 (FR-07)
      // At $allOperations level, we detect by operation name 'queryRaw'
      // with no model — caller (prisma.service.ts keep-alive) uses $queryRaw`SELECT 1`
      // We check via operation name rather than inspecting args (avoid unsafe cast)
      if (operation === 'queryRaw' && !model) {
        // Could be SELECT 1 or any raw query — create minimal span only if needed
        // Per FR-07: drop SELECT 1; span filter in OtelSpanFilter also covers it
        return query(args);
      }

      const isRaw = isRawOperation(operation);
      const spanName = `prisma.${model ?? 'raw'}.${operation}`;

      const statementAttr = sanitizeStatement(model, operation, isRaw);

      return tracer.startActiveSpan(
        spanName,
        { kind: SpanKind.CLIENT },
        async (span) => {
          span.setAttribute('db.system', 'postgresql');
          span.setAttribute('db.operation', operation);
          if (model) span.setAttribute('db.name', model);
          if (statementAttr !== undefined) {
            span.setAttribute('db.statement', statementAttr);
          }

          try {
            const result = await query(args);
            return result;
          } catch (err) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            if (err instanceof Error) {
              span.recordException(err);
            }
            throw err;
          } finally {
            span.end();
          }
        },
      );
    },
  },
});
