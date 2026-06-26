import { describe, it, expect, vi } from 'vitest';
import { OtelSpanFilter } from '../otel-span-filter';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { Span } from '@opentelemetry/sdk-trace-base';
import type { Context } from '@opentelemetry/api';

function makeMockNext(): SpanProcessor & { endCallCount: number } {
  const mock = {
    endCallCount: 0,
    onStart: vi.fn(),
    onEnd: vi.fn(function (this: typeof mock) { this.endCallCount++; }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    forceFlush: vi.fn().mockResolvedValue(undefined),
  };
  return mock;
}

function makeSpan(attrs: Record<string, unknown>): Span & ReadableSpan {
  return {
    attributes: { ...attrs },
  } as unknown as Span & ReadableSpan;
}

describe('OtelSpanFilter', () => {
  describe('health endpoint filtering', () => {
    it('drops /api/health spans at onEnd', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'http.url': '/api/health' });
      filter.onEnd(span as ReadableSpan);

      expect(next.endCallCount).toBe(0);
    });

    it('drops /api/v1/admin/health spans', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'http.target': '/api/v1/admin/health' });
      filter.onEnd(span as ReadableSpan);

      expect(next.endCallCount).toBe(0);
    });

    it('drops subpath /api/health/ping', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'http.url': '/api/health/ping' });
      filter.onEnd(span as ReadableSpan);

      expect(next.endCallCount).toBe(0);
    });

    it('does NOT drop normal API endpoints', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'http.url': '/api/v1/groups' });
      filter.onEnd(span as ReadableSpan);

      expect(next.endCallCount).toBe(1);
    });
  });

  describe('noise statement filtering', () => {
    it('drops SELECT 1 keep-alive spans', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'db.statement': 'SELECT 1' });
      filter.onEnd(span as ReadableSpan);

      expect(next.endCallCount).toBe(0);
    });

    it('drops SELECT version() spans', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'db.statement': 'SELECT version()' });
      filter.onEnd(span as ReadableSpan);

      expect(next.endCallCount).toBe(0);
    });

    it('drops SET LOCAL app.current_tenant_id spans (RLS setup — OWASP M1)', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'db.statement': "SET LOCAL app.current_tenant_id = 'abc-uuid'" });
      filter.onEnd(span as ReadableSpan);

      expect(next.endCallCount).toBe(0);
    });

    it('does NOT drop normal Prisma spans (user.findMany)', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'db.statement': 'user.findMany', 'db.system': 'postgresql' });
      filter.onEnd(span as ReadableSpan);

      expect(next.endCallCount).toBe(1);
    });
  });

  describe('onStart forwarding', () => {
    it('forwards non-filtered spans to next.onStart', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'http.url': '/api/v1/trails' });
      const ctx = {} as Context;
      filter.onStart(span as Span, ctx);

      expect(next.onStart).toHaveBeenCalledWith(span, ctx);
    });

    it('does NOT forward health spans to next.onStart', () => {
      const next = makeMockNext();
      const filter = new OtelSpanFilter(next);

      const span = makeSpan({ 'http.url': '/api/health' });
      const ctx = {} as Context;
      filter.onStart(span as Span, ctx);

      expect(next.onStart).not.toHaveBeenCalled();
    });
  });
});
