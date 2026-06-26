import { describe, it, expect, vi } from 'vitest';
import { OtelAllowlistProcessor, SPAN_ATTRIBUTE_ALLOWLIST } from '../otel-allowlist-processor';
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { Span } from '@opentelemetry/sdk-trace-base';
import type { Context } from '@opentelemetry/api';

function makeMockNext(): SpanProcessor & { lastEndSpan?: ReadableSpan } {
  return {
    onStart: vi.fn(),
    onEnd: vi.fn(function (this: SpanProcessor & { lastEndSpan?: ReadableSpan }, span: ReadableSpan) {
      (this as unknown as { lastEndSpan: ReadableSpan }).lastEndSpan = span;
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    forceFlush: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSpanWithAttrs(attrs: Record<string, unknown>): ReadableSpan {
  return {
    attributes: { ...attrs },
  } as unknown as ReadableSpan;
}

describe('OtelAllowlistProcessor', () => {
  it('removes attributes not in allowlist', () => {
    const next = makeMockNext();
    const processor = new OtelAllowlistProcessor(next);

    const span = makeSpanWithAttrs({
      'http.method': 'GET',
      'url.query': '?token=secret&email=user@example.com',
      'custom.internal.field': 'top-secret',
    });

    processor.onEnd(span);

    expect(span.attributes).toHaveProperty('http.method', 'GET');
    expect(span.attributes).not.toHaveProperty('url.query');
    expect(span.attributes).not.toHaveProperty('custom.internal.field');
  });

  it('keeps all allowlisted attributes', () => {
    const next = makeMockNext();
    const processor = new OtelAllowlistProcessor(next);

    const allowedAttrs: Record<string, unknown> = {};
    for (const key of SPAN_ATTRIBUTE_ALLOWLIST) {
      allowedAttrs[key] = 'value';
    }

    const span = makeSpanWithAttrs(allowedAttrs);
    processor.onEnd(span);

    for (const key of SPAN_ATTRIBUTE_ALLOWLIST) {
      expect(span.attributes).toHaveProperty(key, 'value');
    }
  });

  it('forwards to next processor after scrubbing', () => {
    const next = makeMockNext();
    const processor = new OtelAllowlistProcessor(next);

    const span = makeSpanWithAttrs({ 'http.method': 'POST', 'not-allowed': 'secret' });
    processor.onEnd(span);

    expect(next.onEnd).toHaveBeenCalledWith(span);
  });

  it('forwards onStart to next', () => {
    const next = makeMockNext();
    const processor = new OtelAllowlistProcessor(next);

    const span = {} as Span;
    const ctx = {} as Context;
    processor.onStart(span, ctx);

    expect(next.onStart).toHaveBeenCalledWith(span, ctx);
  });

  it('removes url.query with sensitive query params (OWASP M2)', () => {
    const next = makeMockNext();
    const processor = new OtelAllowlistProcessor(next);

    const span = makeSpanWithAttrs({
      'url.query': '?token=abc&email=x@y.com',
      'tenant.id': 'tenant-uuid',
    });

    processor.onEnd(span);

    expect(span.attributes).not.toHaveProperty('url.query');
    expect(span.attributes).toHaveProperty('tenant.id', 'tenant-uuid');
  });
  it('strips query string from allowlisted http.url (OWASP M2)', () => {
    const next = makeMockNext();
    const processor = new OtelAllowlistProcessor(next);

    const span = makeSpanWithAttrs({
      'http.url': '/api/v1/groups?email=user@example.com&token=secret_refresh',
      'http.method': 'GET',
    });

    processor.onEnd(span);

    expect(span.attributes).toHaveProperty('http.url', '/api/v1/groups');
    expect(JSON.stringify(span.attributes)).not.toContain('token');
    expect(JSON.stringify(span.attributes)).not.toContain('email');
  });

  it('keeps db.name (model) for DB span correlation (allowlist)', () => {
    const next = makeMockNext();
    const processor = new OtelAllowlistProcessor(next);

    const span = makeSpanWithAttrs({ 'db.name': 'user', 'db.operation': 'findMany' });
    processor.onEnd(span);

    expect(span.attributes).toHaveProperty('db.name', 'user');
    expect(span.attributes).toHaveProperty('db.operation', 'findMany');
  });
});
