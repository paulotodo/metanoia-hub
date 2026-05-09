import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportError } from '../report-error';
import { ApiError } from '../../api/client';

interface BeaconCall {
  url: string;
  payload: Record<string, unknown>;
}

describe('reportError', () => {
  let beaconCalls: BeaconCall[];
  let originalSendBeacon: typeof navigator.sendBeacon | undefined;

  beforeEach(() => {
    beaconCalls = [];
    originalSendBeacon = navigator.sendBeacon?.bind(navigator);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: (url: string, blob: Blob) => {
        return blob.text().then((text) => {
          beaconCalls.push({ url, payload: JSON.parse(text) });
          return true;
        }) as unknown as boolean; // sendBeacon returns boolean — we cheat for the test
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalSendBeacon) {
      Object.defineProperty(navigator, 'sendBeacon', {
        configurable: true,
        writable: true,
        value: originalSendBeacon,
      });
    }
    vi.restoreAllMocks();
  });

  it('describes ApiError with name, message, statusCode', async () => {
    reportError(new ApiError(403, 'Forbidden', 'no access'), {
      route: '/foo',
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(beaconCalls).toHaveLength(1);
    const payload = beaconCalls[0]?.payload ?? {};
    expect(payload.errorName).toBe('Forbidden');
    expect(payload.message).toBe('no access');
    expect(payload.statusCode).toBe(403);
    expect(payload.route).toBe('/foo');
    expect(payload.timestamp).toBeTruthy();
  });

  it('describes generic Error', async () => {
    reportError(new Error('boom'));
    await new Promise((r) => setTimeout(r, 0));

    const payload = beaconCalls[0]?.payload ?? {};
    expect(payload.errorName).toBe('Error');
    expect(payload.message).toBe('boom');
    expect(payload.statusCode).toBeUndefined();
  });

  it('truncates long messages to 500 chars', async () => {
    reportError(new Error('x'.repeat(5_000)));
    await new Promise((r) => setTimeout(r, 0));

    const payload = beaconCalls[0]?.payload ?? {};
    expect((payload.message as string).length).toBe(500);
  });

  it('includes optional digest, componentStack, userId, tenantId', async () => {
    reportError(new Error('boom'), {
      digest: 'abc',
      componentStack: 'at A\n  at B',
      userId: 'u-1',
      tenantId: 't-1',
    });
    await new Promise((r) => setTimeout(r, 0));

    const payload = beaconCalls[0]?.payload ?? {};
    expect(payload.digest).toBe('abc');
    expect(payload.componentStack).toBe('at A\n  at B');
    expect(payload.userId).toBe('u-1');
    expect(payload.tenantId).toBe('t-1');
  });

  it('never throws when sendBeacon fails', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error('beacon blocked');
      },
    });
    expect(() => reportError(new Error('x'))).not.toThrow();
  });
});
