import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequestContextMiddleware } from '../request-context.middleware';
import { requestContext, getRequestContext } from '../request-context';

vi.mock('uuidv7', () => ({
  uuidv7: vi.fn(() => '019078ab-0000-7000-8000-000000000001'),
}));

function makeRes() {
  return { setHeader: vi.fn() } as any;
}

describe('RequestContextMiddleware', () => {
  let middleware: RequestContextMiddleware;

  beforeEach(() => {
    middleware = new RequestContextMiddleware();
  });

  it('should create a store with a valid requestId', async () => {
    const req = { headers: {} } as any;
    const res = makeRes();

    await new Promise<void>((resolve) => {
      middleware.use(req, res, () => {
        const store = requestContext.getStore();
        expect(store).toBeDefined();
        expect(store!.requestId).toBe('019078ab-0000-7000-8000-000000000001');
        resolve();
      });
    });
  });

  it('should default correlationId to requestId when header is absent', async () => {
    const req = { headers: {} } as any;
    const res = makeRes();

    await new Promise<void>((resolve) => {
      middleware.use(req, res, () => {
        const store = requestContext.getStore();
        expect(store!.correlationId).toBe(store!.requestId);
        resolve();
      });
    });
  });

  it('should use X-Correlation-Id header when present', async () => {
    const req = {
      headers: { 'x-correlation-id': 'external-corr-id-999' },
    } as any;
    const res = makeRes();

    await new Promise<void>((resolve) => {
      middleware.use(req, res, () => {
        const store = requestContext.getStore();
        expect(store!.correlationId).toBe('external-corr-id-999');
        expect(store!.requestId).toBe('019078ab-0000-7000-8000-000000000001');
        resolve();
      });
    });
  });

  it('should initialize tenantId as empty string', async () => {
    const req = { headers: {} } as any;
    const res = makeRes();

    await new Promise<void>((resolve) => {
      middleware.use(req, res, () => {
        const store = requestContext.getStore();
        expect(store!.tenantId).toBe('');
        expect(store!.userId).toBeUndefined();
        resolve();
      });
    });
  });

  it('should propagate errors thrown by next()', () => {
    const req = { headers: {} } as any;
    const res = makeRes();

    expect(() => {
      middleware.use(req, res, () => {
        throw new Error('downstream failure');
      });
    }).toThrow('downstream failure');
  });

  it('should set X-Request-Id response header with the generated requestId', async () => {
    const req = { headers: {} } as any;
    const res = makeRes();

    await new Promise<void>((resolve) => {
      middleware.use(req, res, () => {
        expect(res.setHeader).toHaveBeenCalledWith(
          'X-Request-Id',
          expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
        );
        resolve();
      });
    });
  });

  it('should mirror sanitized correlationId in X-Correlation-Id response header', async () => {
    const req = {
      headers: { 'x-correlation-id': 'external-corr-id-999' },
    } as any;
    const res = makeRes();

    await new Promise<void>((resolve) => {
      middleware.use(req, res, () => {
        expect(res.setHeader).toHaveBeenCalledWith(
          'X-Correlation-Id',
          'external-corr-id-999',
        );
        resolve();
      });
    });
  });

  it('should isolate context between concurrent requests', async () => {
    const req1 = { headers: {} } as any;
    const req2 = { headers: {} } as any;
    const res = makeRes();

    const { uuidv7 } = await import('uuidv7');
    let callCount = 0;
    vi.mocked(uuidv7).mockImplementation(() => {
      callCount++;
      return `req-id-${callCount}`;
    });

    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        middleware.use(req1, res, () => {
          const store = requestContext.getStore();
          results.push(`r1:${store!.requestId}`);
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        middleware.use(req2, res, () => {
          const store = requestContext.getStore();
          results.push(`r2:${store!.requestId}`);
          resolve();
        });
      }),
    ]);

    expect(results).toContain('r1:req-id-1');
    expect(results).toContain('r2:req-id-2');
  });
});

describe('getRequestContext', () => {
  it('should throw when called outside of middleware scope', () => {
    expect(() => getRequestContext()).toThrow(
      'RequestContext not initialized',
    );
  });

  it('should return the store when called inside middleware scope', async () => {
    const middleware = new RequestContextMiddleware();
    const req = { headers: {} } as any;
    const res = { setHeader: vi.fn() } as any;

    await new Promise<void>((resolve) => {
      middleware.use(req, res, () => {
        const ctx = getRequestContext();
        expect(ctx.requestId).toBeDefined();
        resolve();
      });
    });
  });
});
