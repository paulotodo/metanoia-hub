import { describe, it, expect } from 'vitest';
import { ClientErrorReportSchema } from '../observability';

describe('ClientErrorReportSchema (contract snapshot)', () => {
  it('accepts a fully-populated report', () => {
    const parsed = ClientErrorReportSchema.parse({
      errorName: 'TypeError',
      message: 'cannot read x',
      statusCode: 500,
      route: '/x',
      componentStack: 'at A',
      digest: 'abc',
      userId: '019486f0-1234-7abc-89de-fedcba987654',
      tenantId: '019486f0-aaaa-7bbb-9ccc-ddddeeeeffff',
      timestamp: new Date().toISOString(),
    });
    expect(parsed.errorName).toBe('TypeError');
  });

  it('accepts a minimal report (only required fields)', () => {
    const parsed = ClientErrorReportSchema.parse({
      errorName: 'X',
      message: 'y',
    });
    expect(parsed.errorName).toBe('X');
    expect(parsed.statusCode).toBeUndefined();
  });

  it('rejects empty errorName', () => {
    expect(() =>
      ClientErrorReportSchema.parse({ errorName: '', message: 'y' }),
    ).toThrow();
  });

  it('rejects oversized message (gates against PII smuggling)', () => {
    expect(() =>
      ClientErrorReportSchema.parse({
        errorName: 'X',
        message: 'a'.repeat(501),
      }),
    ).toThrow();
  });

  it('rejects non-UUID userId/tenantId', () => {
    expect(() =>
      ClientErrorReportSchema.parse({
        errorName: 'X',
        message: 'y',
        userId: 'paulo@example.com',
      }),
    ).toThrow();
  });

  it('snapshots field shape to gate against silent breaking changes', () => {
    const shape = Object.keys(ClientErrorReportSchema.shape).sort();
    expect(shape).toMatchInlineSnapshot(`
      [
        "componentStack",
        "digest",
        "errorName",
        "message",
        "route",
        "statusCode",
        "tenantId",
        "timestamp",
        "userId",
      ]
    `);
  });
});
