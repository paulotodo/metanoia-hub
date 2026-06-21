/**
 * Unit tests for NotificationsController (Story 14-2b)
 * Tests: read-all endpoint routing, response envelope, BOLA-safety
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsController } from './notifications.controller';

// ---------------------------------------------------------------------------
// Mock getRequestContext
// ---------------------------------------------------------------------------

const mockUserId = 'user-context-001';

vi.mock('../common/context/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    tenantId: 'tenant-001',
    userId: mockUserId,
    correlationId: 'corr-001',
  })),
}));

// ---------------------------------------------------------------------------
// Mock service
// ---------------------------------------------------------------------------

function createController() {
  const service = {
    findByUser: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, perPage: 20, total: 0 } }),
    markAllAsRead: vi.fn().mockResolvedValue(5),
    updateStatusForUser: vi.fn().mockResolvedValue(undefined),
    dispatch: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new NotificationsController(service as never);
  return { controller, service };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// PATCH /read-all
// ---------------------------------------------------------------------------

describe('NotificationsController PATCH /read-all', () => {
  it('calls markAllAsRead with userId from context (BOLA-safe)', async () => {
    const { controller, service } = createController();
    await controller.markAllRead();
    expect(service.markAllAsRead).toHaveBeenCalledWith(mockUserId, expect.any(Date));
  });

  it('returns { data: { updatedCount } } envelope', async () => {
    const { controller, service } = createController();
    service.markAllAsRead.mockResolvedValue(3);
    const result = await controller.markAllRead();
    expect(result).toEqual({ data: { updatedCount: 3 } });
  });

  it('markAllAsRead never receives tenantId as arg (RLS enforces tenant)', async () => {
    const { controller, service } = createController();
    await controller.markAllRead();
    // Only 2 args: userId and readAt Date
    const [arg1, arg2, ...rest] = service.markAllAsRead.mock.calls[0] as [string, Date];
    expect(typeof arg1).toBe('string'); // userId
    expect(arg2).toBeInstanceOf(Date);  // readAt
    expect(rest).toHaveLength(0);       // no tenantId
  });
});

// ---------------------------------------------------------------------------
// Routing: static segment 'read-all' before dynamic ':id'
// ---------------------------------------------------------------------------

describe('NotificationsController routing — read-all before :id', () => {
  it('markAllRead handler exists and does not call updateStatusForUser', async () => {
    const { controller, service } = createController();
    await controller.markAllRead();
    expect(service.markAllAsRead).toHaveBeenCalled();
    expect(service.updateStatusForUser).not.toHaveBeenCalled();
  });

  it('markRead handler calls updateStatusForUser with UUID param', async () => {
    const { controller, service } = createController();
    const notifId = '019756c0-0002-7000-8000-000000000099';
    await controller.markRead(notifId);
    expect(service.updateStatusForUser).toHaveBeenCalledWith(
      notifId,
      mockUserId,
      'read',
      expect.any(Date),
    );
    expect(service.markAllAsRead).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /notifications — userId from context
// ---------------------------------------------------------------------------

describe('NotificationsController GET /notifications', () => {
  it('passes userId from RequestContext (BOLA-safe)', async () => {
    const { controller, service } = createController();
    await controller.list({ status: undefined, page: 1, perPage: 20 });
    expect(service.findByUser).toHaveBeenCalledWith(mockUserId, expect.any(Object));
  });
});
