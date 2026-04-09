import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArgumentsHost, HttpException } from '@nestjs/common';
import { requestContext } from '../../context/request-context';

vi.mock('@sentry/nestjs', () => ({
  withScope: vi.fn((cb: (scope: any) => void) => {
    const scope = {
      setTag: vi.fn(),
      setUser: vi.fn(),
    };
    cb(scope);
    return scope;
  }),
  captureException: vi.fn(),
}));

import * as Sentry from '@sentry/nestjs';
import { SentryExceptionFilter } from '../sentry.filter';

describe('SentryExceptionFilter', () => {
  let filter: SentryExceptionFilter;
  let mockHost: ArgumentsHost;
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
    } as unknown as ArgumentsHost;

    // Create filter with a mock httpAdapter
    filter = new SentryExceptionFilter({
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

  it('should call Sentry.captureException with the exception', () => {
    const error = new HttpException('Test error', 500);

    filter.catch(error, mockHost);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('should set Sentry scope tags from RequestContext', async () => {
    const store = {
      tenantId: 'tenant-abc',
      userId: 'user-123',
      requestId: 'req-001',
      correlationId: 'corr-001',
    };

    let capturedScope: any;
    vi.mocked(Sentry.withScope).mockImplementation((cb: any) => {
      const scope = { setTag: vi.fn(), setUser: vi.fn() };
      capturedScope = scope;
      cb(scope);
    });

    await new Promise<void>((resolve) => {
      requestContext.run(store, () => {
        const error = new HttpException('Test', 500);
        filter.catch(error, mockHost);

        expect(capturedScope.setTag).toHaveBeenCalledWith('tenantId', 'tenant-abc');
        expect(capturedScope.setTag).toHaveBeenCalledWith('requestId', 'req-001');
        expect(capturedScope.setTag).toHaveBeenCalledWith('correlationId', 'corr-001');
        expect(capturedScope.setUser).toHaveBeenCalledWith({ id: 'user-123' });
        resolve();
      });
    });
  });

  it('should not set tenant/user tags when context is empty', () => {
    let capturedScope: any;
    vi.mocked(Sentry.withScope).mockImplementation((cb: any) => {
      const scope = { setTag: vi.fn(), setUser: vi.fn() };
      capturedScope = scope;
      cb(scope);
    });

    const error = new HttpException('Test', 500);
    filter.catch(error, mockHost);

    expect(capturedScope.setTag).not.toHaveBeenCalledWith('tenantId', expect.anything());
    expect(capturedScope.setUser).not.toHaveBeenCalled();
  });

  it('should still call super.catch to handle the response', () => {
    const error = new HttpException('Test error', 400);

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalled();
  });
});
