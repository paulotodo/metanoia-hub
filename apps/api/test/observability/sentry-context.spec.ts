import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestContext } from '../../src/common/context/request-context';
import type { RequestContext } from '../../src/common/context/request-context';

vi.mock('@sentry/nestjs', () => ({
  withScope: vi.fn((cb: (scope: any) => void) => {
    const scope = { setTag: vi.fn(), setUser: vi.fn() };
    cb(scope);
    return scope;
  }),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/nestjs';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

/**
 * NFR-O2: Application errors generate Sentry alerts
 * with sufficient diagnostic context.
 */
describe('NFR-O2: Sentry receives adequate context on errors', () => {
  let filter: AllExceptionsFilter;
  let mockHost: any;
  let mockResponse: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockHost = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/test' }),
        getResponse: () => mockResponse,
        getNext: () => vi.fn(),
      }),
      getArgs: () => [],
      getArgByIndex: () => ({}),
      switchToRpc: () => ({}) as any,
      switchToWs: () => ({}) as any,
      getType: () => 'http' as any,
    };

    filter = new AllExceptionsFilter({
      reply: (_response: any, body: any, statusCode: number) => {
        mockResponse.status(statusCode);
        mockResponse.json(body);
      },
      status: (_response: any, statusCode: number) => {
        mockResponse.status(statusCode);
      },
      getRequestHostname: () => 'localhost',
      getRequestMethod: () => 'GET',
      getRequestUrl: () => '/test',
      isHeadersSent: () => false,
    } as any);
  });

  it('should capture exception with tenant_id and user_id context', async () => {
    const store: RequestContext = {
      tenantId: 'tenant-nfr',
      userId: 'user-nfr',
      requestId: 'req-nfr-001',
      correlationId: 'corr-nfr-001',
    };

    let capturedScope: any;
    vi.mocked(Sentry.withScope).mockImplementation((cb: any) => {
      const scope = { setTag: vi.fn(), setUser: vi.fn() };
      capturedScope = scope;
      cb(scope);
    });

    await new Promise<void>((resolve) => {
      requestContext.run(store, () => {
        const error = new Error('Unhandled error in business logic');
        filter.catch(error, mockHost);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(capturedScope.setTag).toHaveBeenCalledWith('tenantId', 'tenant-nfr');
        expect(capturedScope.setTag).toHaveBeenCalledWith('requestId', 'req-nfr-001');
        expect(capturedScope.setTag).toHaveBeenCalledWith(
          'correlationId',
          'corr-nfr-001',
        );
        expect(capturedScope.setUser).toHaveBeenCalledWith({ id: 'user-nfr' });
        resolve();
      });
    });
  });

  it('should capture exception without tenant context for unauthenticated errors', () => {
    let capturedScope: any;
    vi.mocked(Sentry.withScope).mockImplementation((cb: any) => {
      const scope = { setTag: vi.fn(), setUser: vi.fn() };
      capturedScope = scope;
      cb(scope);
    });

    const error = new Error('Public route error');
    filter.catch(error, mockHost);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(capturedScope.setTag).not.toHaveBeenCalledWith(
      'tenantId',
      expect.anything(),
    );
    expect(capturedScope.setUser).not.toHaveBeenCalled();
  });

  it('should include requestId even when tenant is not set', async () => {
    const store: RequestContext = {
      tenantId: '',
      requestId: 'req-public-002',
      correlationId: 'req-public-002',
    };

    let capturedScope: any;
    vi.mocked(Sentry.withScope).mockImplementation((cb: any) => {
      const scope = { setTag: vi.fn(), setUser: vi.fn() };
      capturedScope = scope;
      cb(scope);
    });

    await new Promise<void>((resolve) => {
      requestContext.run(store, () => {
        const error = new Error('Error on public route');
        filter.catch(error, mockHost);

        expect(capturedScope.setTag).toHaveBeenCalledWith(
          'requestId',
          'req-public-002',
        );
        expect(capturedScope.setTag).not.toHaveBeenCalledWith(
          'tenantId',
          expect.anything(),
        );
        resolve();
      });
    });
  });
});
