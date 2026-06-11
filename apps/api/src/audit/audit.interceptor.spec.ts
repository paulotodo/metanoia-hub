/**
 * Unit tests for AuditInterceptor.
 *
 * Covers:
 *   - WRITE methods (POST/PUT/PATCH/DELETE) trigger createEvent
 *   - GET/HEAD/OPTIONS do NOT trigger createEvent (FR-011)
 *   - Excluded paths (/health, /metrics) are skipped
 *   - userId extracted from req.user (null for public routes — SEC-008)
 *   - IP extracted from X-Forwarded-For → X-Real-IP → socket.remoteAddress
 *   - resource + resourceId derived from path
 *   - action mapped from method + status code
 *   - newState captured from response body (truncation at 64KB)
 *   - Non-2xx responses do NOT trigger createEvent
 *   - AuditService.createEvent() errors are silently swallowed (FR-INFRA-01)
 *
 * Story 9-3 (LGPD — Immutable Audit Log) — FASE 2.4
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AUDIT_PAYLOAD_TRUNCATE_BYTES } from '@metanoia/types';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<{
  method: string;
  path: string;
  headers: Record<string, string>;
  user: { userId: string } | null;
  socket: { remoteAddress: string };
}> = {}) {
  return {
    method: 'POST',
    path: '/api/v1/groups',
    headers: {},
    user: { userId: 'user-01' },
    socket: { remoteAddress: '10.0.0.1' },
    ...overrides,
  };
}

function makeResponse(statusCode = 201) {
  return { statusCode };
}

function makeContext(req: ReturnType<typeof makeRequest>, res = makeResponse()): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    getClass: vi.fn(),
    getHandler: vi.fn(),
    getArgs: vi.fn(),
    getArgByIndex: vi.fn(),
    switchToRpc: vi.fn(),
    switchToWs: vi.fn(),
    getType: vi.fn(),
  } as unknown as ExecutionContext;
}

function makeHandler(responseBody: unknown = { id: 'group-01' }): CallHandler {
  return { handle: () => of(responseBody) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuditInterceptor', () => {
  const createEvent = vi.fn().mockResolvedValue(undefined);
  const mockAuditService = { createEvent };

  let interceptor: AuditInterceptor;

  beforeEach(() => {
    vi.clearAllMocks();
    interceptor = new AuditInterceptor(
      mockAuditService as unknown as ConstructorParameters<typeof AuditInterceptor>[0],
    );
  });

  // ─── WRITE methods trigger audit ─────────────────────────────────────────

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    '%s triggers createEvent',
    async (method) => {
      const req = makeRequest({ method });
      const ctx = makeContext(req, makeResponse(method === 'POST' ? 201 : 200));

      await new Promise<void>((resolve) => {
        interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
      });

      expect(createEvent).toHaveBeenCalledOnce();
    },
  );

  // ─── READ methods skipped ─────────────────────────────────────────────────

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    '%s does NOT trigger createEvent (FR-011)',
    async (method) => {
      const req = makeRequest({ method, path: '/api/v1/groups' });
      const ctx = makeContext(req, makeResponse(200));

      await new Promise<void>((resolve) => {
        interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
      });

      expect(createEvent).not.toHaveBeenCalled();
    },
  );

  // ─── Excluded paths ───────────────────────────────────────────────────────

  it.each(['/health', '/metrics', '/api/v1/health'])(
    'skips excluded path %s',
    async (path) => {
      const req = makeRequest({ method: 'POST', path });
      const ctx = makeContext(req);

      await new Promise<void>((resolve) => {
        interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
      });

      expect(createEvent).not.toHaveBeenCalled();
    },
  );

  // ─── userId extraction ────────────────────────────────────────────────────

  it('passes userId from req.user', async () => {
    const req = makeRequest({ user: { userId: 'user-abc' } });
    const ctx = makeContext(req, makeResponse(201));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-abc' }));
  });

  it('passes null userId for public routes (SEC-008)', async () => {
    const req = makeRequest({ user: null });
    const ctx = makeContext(req, makeResponse(201));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  // ─── IP extraction ────────────────────────────────────────────────────────

  it('extracts IP from X-Forwarded-For (first)', async () => {
    const req = makeRequest({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    const ctx = makeContext(req, makeResponse(201));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '1.2.3.4' }));
  });

  it('falls back to X-Real-IP when no X-Forwarded-For', async () => {
    const req = makeRequest({ headers: { 'x-real-ip': '9.8.7.6' } });
    const ctx = makeContext(req, makeResponse(201));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '9.8.7.6' }));
  });

  it('falls back to socket.remoteAddress', async () => {
    const req = makeRequest({ socket: { remoteAddress: '192.168.1.1' } });
    const ctx = makeContext(req, makeResponse(201));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '192.168.1.1' }),
    );
  });

  // ─── resource + resourceId extraction ────────────────────────────────────

  it('extracts resource from /api/v1/<resource>/...', async () => {
    const req = makeRequest({ path: '/api/v1/groups' });
    const ctx = makeContext(req, makeResponse(201));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'groups', resourceId: null }),
    );
  });

  it('extracts resourceId from /api/v1/<resource>/<id>', async () => {
    const req = makeRequest({ method: 'PATCH', path: '/api/v1/groups/group-99' });
    const ctx = makeContext(req, makeResponse(200));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'groups', resourceId: 'group-99' }),
    );
  });

  // ─── action mapping ───────────────────────────────────────────────────────

  it('POST + 201 → action create', async () => {
    const req = makeRequest({ method: 'POST' });
    const ctx = makeContext(req, makeResponse(201));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'create' }));
  });

  it('DELETE → action delete', async () => {
    const req = makeRequest({ method: 'DELETE', path: '/api/v1/groups/g-01' });
    const ctx = makeContext(req, makeResponse(204));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler({ })).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete' }));
  });

  it('PATCH → action update', async () => {
    const req = makeRequest({ method: 'PATCH', path: '/api/v1/groups/g-01' });
    const ctx = makeContext(req, makeResponse(200));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
  });

  // ─── newState capture ─────────────────────────────────────────────────────

  it('captures newState from response body', async () => {
    const req = makeRequest();
    const ctx = makeContext(req, makeResponse(201));
    const responseBody = { id: 'g-01', name: 'Test Group' };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler(responseBody)).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ newState: responseBody }),
    );
  });

  it('truncates newState > 64KB (dec-019)', async () => {
    const req = makeRequest();
    const ctx = makeContext(req, makeResponse(201));
    const largeBody = { data: 'x'.repeat(AUDIT_PAYLOAD_TRUNCATE_BYTES + 1) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler(largeBody)).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        newState: expect.objectContaining({ __truncated: true }),
      }),
    );
  });

  it('passes null newState for non-object (string) responses', async () => {
    const req = makeRequest({ method: 'DELETE', path: '/api/v1/groups/g-01' });
    const ctx = makeContext(req, makeResponse(204));

    // String is not an object → safeBodyToState returns null
    const stringHandler: CallHandler = { handle: () => of('deleted') };
    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, stringHandler).subscribe({ complete: resolve });
    });

    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ newState: null }),
    );
  });

  // ─── Non-2xx responses ────────────────────────────────────────────────────

  it('does NOT audit 4xx responses', async () => {
    const req = makeRequest();
    const ctx = makeContext(req, makeResponse(400));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).not.toHaveBeenCalled();
  });

  it('does NOT audit 5xx responses', async () => {
    const req = makeRequest();
    const ctx = makeContext(req, makeResponse(500));

    await new Promise<void>((resolve) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({ complete: resolve });
    });

    expect(createEvent).not.toHaveBeenCalled();
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  it('propagates handler errors (does not swallow request errors)', async () => {
    const req = makeRequest();
    const ctx = makeContext(req);
    const errorHandler: CallHandler = {
      handle: () => throwError(() => new Error('handler failed')),
    };

    const error = await new Promise<Error>((resolve) => {
      interceptor.intercept(ctx, errorHandler).subscribe({
        error: (e: Error) => resolve(e),
      });
    });

    expect(error.message).toBe('handler failed');
    expect(createEvent).not.toHaveBeenCalled();
  });

  it('silently swallows AuditService errors (FR-INFRA-01)', async () => {
    createEvent.mockRejectedValue(new Error('audit DB down'));
    const req = makeRequest();
    const ctx = makeContext(req, makeResponse(201));

    // Should complete without throwing
    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(ctx, makeHandler()).subscribe({
        complete: resolve,
        error: reject,
      });
    });

    // createEvent was called but error was swallowed
    expect(createEvent).toHaveBeenCalledOnce();
  });
});
