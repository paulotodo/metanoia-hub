import { describe, it, expect, vi } from 'vitest';
import { ContextSpanProcessor } from '../context-span-processor';
import { requestContext } from '../../context/request-context';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { Span } from '@opentelemetry/sdk-trace-base';
import type { Context } from '@opentelemetry/api';

function makeMockNext(): SpanProcessor {
  return {
    onStart: vi.fn(),
    onEnd: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
    forceFlush: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSpan(): Span {
  const attrs: Record<string, unknown> = {};
  return {
    attributes: attrs,
    setAttribute: vi.fn((key: string, value: unknown) => { attrs[key] = value; }),
  } as unknown as Span;
}

describe('ContextSpanProcessor', () => {
  it('sets tenant.id, user.id, correlation_id when RequestContext is available', () => {
    const next = makeMockNext();
    const processor = new ContextSpanProcessor(next);
    const span = makeSpan();
    const ctx = {} as Context;

    requestContext.run(
      { tenantId: 'tenant-abc', userId: 'user-uuid', requestId: 'req-id', correlationId: 'corr-id' },
      () => {
        processor.onStart(span, ctx);
      },
    );

    expect(span.setAttribute).toHaveBeenCalledWith('tenant.id', 'tenant-abc');
    expect(span.setAttribute).toHaveBeenCalledWith('user.id', 'user-uuid');
    expect(span.setAttribute).toHaveBeenCalledWith('correlation_id', 'corr-id');
  });

  it('does NOT set user.id when userId is undefined (unauthenticated)', () => {
    const next = makeMockNext();
    const processor = new ContextSpanProcessor(next);
    const span = makeSpan();
    const ctx = {} as Context;

    requestContext.run(
      { tenantId: 'tenant-abc', userId: undefined, requestId: 'req-id', correlationId: 'corr-id' },
      () => {
        processor.onStart(span, ctx);
      },
    );

    expect(span.setAttribute).not.toHaveBeenCalledWith('user.id', expect.anything());
  });

  it('no-op outside RequestContext (no throw)', () => {
    const next = makeMockNext();
    const processor = new ContextSpanProcessor(next);
    const span = makeSpan();
    const ctx = {} as Context;

    // Outside requestContext.run() — should not throw
    expect(() => processor.onStart(span, ctx)).not.toThrow();
    // Still forwards to next
    expect(next.onStart).toHaveBeenCalled();
  });

  it('forwards onEnd to next', () => {
    const next = makeMockNext();
    const processor = new ContextSpanProcessor(next);
    const span = {} as ReadableSpan;
    processor.onEnd(span);
    expect(next.onEnd).toHaveBeenCalledWith(span);
  });
});
