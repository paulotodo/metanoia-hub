import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { LastSeenInterceptor } from './last-seen.interceptor';
import { requestContext } from '../context/request-context';

const mockSet = vi.fn();
const mockExecuteRaw = vi.fn();
const mockTx = { $executeRawUnsafe: mockExecuteRaw };

// RedisService extends ioredis Redis — `set` is called directly on the service
const mockRedis = {
  set: mockSet,
} as never;

// PrismaService.client.$transaction is used by withTenantTx
const mockPrismaClient = {
  $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};
const mockPrisma = {
  client: mockPrismaClient,
} as never;

const mockCallHandler = {
  handle: () => of('response'),
};

const mockContext = {} as never;

describe('LastSeenInterceptor', () => {
  let interceptor: LastSeenInterceptor;

  beforeEach(() => {
    vi.clearAllMocks();
    interceptor = new LastSeenInterceptor(mockRedis, mockPrisma);
  });

  it('does not update when no request context', async () => {
    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        complete: () => setTimeout(resolve, 10),
      });
    });
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not update when userId is absent from context', async () => {
    await requestContext.run(
      { tenantId: 'aabbccdd-0000-0000-0000-aabbccdd0001', requestId: 'r', correlationId: 'c' },
      async () => {
        await new Promise<void>((resolve) => {
          interceptor.intercept(mockContext, mockCallHandler).subscribe({
            complete: () => setTimeout(resolve, 20),
          });
        });
      },
    );
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('skips DB write when Redis debounce key exists (acquired = null)', async () => {
    mockSet.mockResolvedValue(null); // NX failed — key exists

    await requestContext.run(
      { tenantId: 'aabbccdd-0000-0000-0000-aabbccdd0001', userId: 'aabbccdd-0000-0000-0000-aabbccdd0002', requestId: 'r', correlationId: 'c' },
      async () => {
        await new Promise<void>((resolve) => {
          interceptor.intercept(mockContext, mockCallHandler).subscribe({
            complete: () => setTimeout(resolve, 20),
          });
        });
      },
    );

    expect(mockSet).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith(
      'rt:lastseen:aabbccdd-0000-0000-0000-aabbccdd0001:aabbccdd-0000-0000-0000-aabbccdd0002',
      '1',
      'EX',
      900,
      'NX',
    );
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('writes last_seen_at when Redis NX succeeds', async () => {
    mockSet.mockResolvedValue('OK');
    mockExecuteRaw.mockResolvedValue(1);

    await requestContext.run(
      { tenantId: 'aabbccdd-0000-0000-0000-aabbccdd0001', userId: 'aabbccdd-0000-0000-0000-aabbccdd0002', requestId: 'r', correlationId: 'c' },
      async () => {
        await new Promise<void>((resolve) => {
          interceptor.intercept(mockContext, mockCallHandler).subscribe({
            complete: () => setTimeout(resolve, 20),
          });
        });
      },
    );

    expect(mockSet).toHaveBeenCalledOnce();
    // withTenantTx issues `SET LOCAL app.current_tenant_id` first, then the UPDATE
    expect(mockExecuteRaw).toHaveBeenCalledWith(
      'UPDATE users SET last_seen_at = now() WHERE id = $1::uuid',
      'aabbccdd-0000-0000-0000-aabbccdd0002',
    );
  });

  it('is fail-open when Redis throws', async () => {
    mockSet.mockRejectedValue(new Error('Redis connection refused'));

    await expect(
      requestContext.run(
        { tenantId: 'aabbccdd-0000-0000-0000-aabbccdd0001', userId: 'aabbccdd-0000-0000-0000-aabbccdd0002', requestId: 'r', correlationId: 'c' },
        async () => {
          await new Promise<void>((resolve) => {
            interceptor.intercept(mockContext, mockCallHandler).subscribe({
              complete: () => setTimeout(resolve, 20),
            });
          });
        },
      ),
    ).resolves.toBeUndefined(); // does not throw

    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});
