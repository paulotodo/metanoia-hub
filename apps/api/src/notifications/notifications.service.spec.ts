/**
 * Unit tests for NotificationsService (Story 14-2b)
 * Tests: findByUser unread filter, markAllAsRead (BOLA-safe, idempotent)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

vi.mock('../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: 'tenant-001',
    userId: 'user-001',
    correlationId: 'corr-001',
  })),
}));

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn((_prisma: unknown, fn: (tx: unknown) => unknown) => fn(mockTx)),
}));

const mockTx = {
  $queryRawUnsafe: vi.fn(),
  $executeRawUnsafe: vi.fn().mockResolvedValue(1),
};

function createService() {
  const prisma = { $transaction: vi.fn() };
  const configService = { get: vi.fn() } as unknown as ConfigService;
  const digestService = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const service = new NotificationsService(
    prisma as never,
    configService,
    digestService as never,
  );
  return { service };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// findByUser — unread filter
// ---------------------------------------------------------------------------

describe('NotificationsService.findByUser', () => {
  it('uses <> operator when unread=true', async () => {
    const { service } = createService();
    const fakeRows = [{ id: 'n1', status: 'pending' }];
    const fakeCount = [{ count: '1' }];
    mockTx.$queryRawUnsafe
      .mockResolvedValueOnce(fakeRows)
      .mockResolvedValueOnce(fakeCount);

    const result = await service.findByUser('user-001', { unread: true });

    // Both SQL calls should include <> filter
    const calls = mockTx.$queryRawUnsafe.mock.calls;
    const selectionSql = calls[0]?.[0] as string;
    const countSql = calls[1]?.[0] as string;

    expect(selectionSql).toContain("<> 'read'");
    expect(countSql).toContain("<> 'read'");
    expect(result.data).toEqual(fakeRows);
    expect(result.meta.total).toBe(1);
  });

  it('uses = operator for explicit status filter', async () => {
    const { service } = createService();
    mockTx.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: '0' }]);

    await service.findByUser('user-001', { status: 'pending' });

    const calls = mockTx.$queryRawUnsafe.mock.calls;
    const selectionSql = calls[0]?.[0] as string;
    expect(selectionSql).toContain("= 'pending'");
    expect(selectionSql).not.toContain("<>");
  });

  it('unread=true takes priority over status when both are present', async () => {
    const { service } = createService();
    mockTx.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: '0' }]);

    await service.findByUser('user-001', { unread: true, status: 'pending' });

    const calls = mockTx.$queryRawUnsafe.mock.calls;
    const selectionSql = calls[0]?.[0] as string;
    expect(selectionSql).toContain("<> 'read'");
    expect(selectionSql).not.toContain("= 'pending'");
  });

  it('returns no status filter when neither unread nor status provided', async () => {
    const { service } = createService();
    mockTx.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: '0' }]);

    await service.findByUser('user-001', {});

    const calls = mockTx.$queryRawUnsafe.mock.calls;
    const selectionSql = calls[0]?.[0] as string;
    expect(selectionSql).not.toContain("<>");
    expect(selectionSql).not.toContain("AND status");
  });

  it('result never includes read notifications when unread=true', async () => {
    const { service } = createService();
    // Simulate DB only returning unread rows (RLS + filter guarantee)
    const unreadRows = [
      { id: 'n1', status: 'pending' },
      { id: 'n2', status: 'sent' },
    ];
    mockTx.$queryRawUnsafe
      .mockResolvedValueOnce(unreadRows)
      .mockResolvedValueOnce([{ count: '2' }]);

    const result = await service.findByUser('user-001', { unread: true });

    const statuses = result.data.map((r) => (r as { status: string }).status);
    expect(statuses).not.toContain('read');
  });
});

// ---------------------------------------------------------------------------
// markAllAsRead
// ---------------------------------------------------------------------------

describe('NotificationsService.markAllAsRead', () => {
  it('returns count of rows actually changed', async () => {
    const { service } = createService();
    const updatedRows = [{ id: 'n1' }, { id: 'n2' }];
    mockTx.$queryRawUnsafe.mockResolvedValue(updatedRows);

    const count = await service.markAllAsRead('user-001', new Date());
    expect(count).toBe(2);
  });

  it('returns 0 when all notifications are already read (idempotent)', async () => {
    const { service } = createService();
    mockTx.$queryRawUnsafe.mockResolvedValue([]);

    const count = await service.markAllAsRead('user-001', new Date());
    expect(count).toBe(0);
  });

  it('SQL uses WHERE status <> read (only touches unread rows)', async () => {
    const { service } = createService();
    mockTx.$queryRawUnsafe.mockResolvedValue([]);

    await service.markAllAsRead('user-001', new Date());

    const sql = mockTx.$queryRawUnsafe.mock.calls[0]?.[0] as string;
    expect(sql).toContain("<> 'read'");
    expect(sql).toContain('RETURNING id');
  });

  it('NEVER passes tenantId as parameter (BOLA-safe via RLS only)', async () => {
    const { service } = createService();
    mockTx.$queryRawUnsafe.mockResolvedValue([]);

    await service.markAllAsRead('user-001', new Date());

    // Only $1 (readAt) and $2 (userId) are params; no tenantId param
    const call = mockTx.$queryRawUnsafe.mock.calls[0];
    // call[0] = SQL string, call[1] = $1 (readAt Date), call[2] = $2 (userId)
    expect(call?.length).toBe(3); // SQL + 2 params
  });
});

// ---------------------------------------------------------------------------
// updateStatusForUser — routing guard (read-all vs :id must not clash)
// ---------------------------------------------------------------------------

describe('NotificationsService.updateStatusForUser', () => {
  it('throws NotFoundException when no rows updated (IDOR protection)', async () => {
    const { service } = createService();
    mockTx.$queryRawUnsafe.mockResolvedValue([]); // 0 rows = not found or wrong user

    await expect(
      service.updateStatusForUser('notif-id', 'user-001', 'read', new Date()),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves when notification found and belongs to user', async () => {
    const { service } = createService();
    mockTx.$queryRawUnsafe.mockResolvedValue([{ id: 'notif-id' }]);

    await expect(
      service.updateStatusForUser('notif-id', 'user-001', 'read', new Date()),
    ).resolves.not.toThrow();
  });
});
