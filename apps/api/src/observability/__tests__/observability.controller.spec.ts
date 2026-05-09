import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/nestjs', () => ({
  withScope: vi.fn((cb: (scope: any) => void) => {
    const scope = {
      setTag: vi.fn(),
      setUser: vi.fn(),
      setExtra: vi.fn(),
    };
    cb(scope);
    return scope;
  }),
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/nestjs';
import { ObservabilityController } from '../observability.controller';

describe('ObservabilityController', () => {
  let controller: ObservabilityController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ObservabilityController();
  });

  it('reports the error to Sentry as a message with full context tags', () => {
    let capturedScope: any;
    vi.mocked(Sentry.withScope).mockImplementation((cb: any) => {
      const scope = {
        setTag: vi.fn(),
        setUser: vi.fn(),
        setExtra: vi.fn(),
      };
      capturedScope = scope;
      cb(scope);
    });

    controller.reportClientError({
      errorName: 'TypeError',
      message: 'Cannot read properties of undefined',
      statusCode: 500,
      route: '/admin/igreja/vista',
      digest: 'abc123',
      tenantId: '019486f0-aaaa-7bbb-9ccc-ddddeeeeffff',
      userId: '019486f0-1234-7abc-89de-fedcba987654',
      componentStack: 'at PageA\n  at LayoutB',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Cannot read properties of undefined',
      'error',
    );
    expect(capturedScope.setTag).toHaveBeenCalledWith(
      'source',
      'frontend-boundary',
    );
    expect(capturedScope.setTag).toHaveBeenCalledWith('errorName', 'TypeError');
    expect(capturedScope.setTag).toHaveBeenCalledWith('statusCode', '500');
    expect(capturedScope.setTag).toHaveBeenCalledWith(
      'route',
      '/admin/igreja/vista',
    );
    expect(capturedScope.setTag).toHaveBeenCalledWith('digest', 'abc123');
    // tenantId/userId from a public endpoint are CLAIMED by an unauthenticated
    // client — namespace them so dashboards never confuse them with token IDs.
    expect(capturedScope.setTag).toHaveBeenCalledWith(
      'claimedTenantId',
      '019486f0-aaaa-7bbb-9ccc-ddddeeeeffff',
    );
    expect(capturedScope.setTag).toHaveBeenCalledWith(
      'claimedUserId',
      '019486f0-1234-7abc-89de-fedcba987654',
    );
    expect(capturedScope.setUser).not.toHaveBeenCalled();
    expect(capturedScope.setExtra).toHaveBeenCalledWith(
      'componentStack',
      'at PageA\n  at LayoutB',
    );
  });

  it('strips control chars from user-supplied strings (log injection guard)', () => {
    let capturedScope: any;
    vi.mocked(Sentry.withScope).mockImplementation((cb: any) => {
      const scope = {
        setTag: vi.fn(),
        setUser: vi.fn(),
        setExtra: vi.fn(),
      };
      capturedScope = scope;
      cb(scope);
    });

    controller.reportClientError({
      errorName: 'TypeError',
      message: 'real message',
      route: '/legit\nFAKE LOG ENTRY',
      digest: 'abc\r123',
    });

    const routeCall = capturedScope.setTag.mock.calls.find(
      (c: unknown[]) => c[0] === 'route',
    );
    const digestCall = capturedScope.setTag.mock.calls.find(
      (c: unknown[]) => c[0] === 'digest',
    );
    expect(routeCall?.[1]).not.toMatch(/[\r\n]/);
    expect(digestCall?.[1]).not.toMatch(/[\r\n]/);
  });

  it('reports without optional fields when omitted', () => {
    let capturedScope: any;
    vi.mocked(Sentry.withScope).mockImplementation((cb: any) => {
      const scope = {
        setTag: vi.fn(),
        setUser: vi.fn(),
        setExtra: vi.fn(),
      };
      capturedScope = scope;
      cb(scope);
    });

    controller.reportClientError({
      errorName: 'BoundaryError',
      message: 'render failed',
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith('render failed', 'error');
    expect(capturedScope.setUser).not.toHaveBeenCalled();
    expect(capturedScope.setExtra).not.toHaveBeenCalled();
  });

  it('swallows Sentry errors silently (telemetry must not crash response)', () => {
    vi.mocked(Sentry.withScope).mockImplementation(() => {
      throw new Error('sentry exploded');
    });

    expect(() =>
      controller.reportClientError({
        errorName: 'X',
        message: 'y',
      }),
    ).not.toThrow();
  });
});
