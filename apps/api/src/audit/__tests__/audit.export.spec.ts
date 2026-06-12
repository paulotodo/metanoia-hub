import { describe, it, expect, vi } from 'vitest';
import { AuditService } from '../audit.service';

const USER_ID = '01912345-6789-7000-8000-0000000000a1';
const TENANT_ID = '01912345-6789-7000-8000-000000000001';

function makePrisma(events: unknown[]) {
  return {
    client: {
      auditEvent: { findMany: vi.fn().mockResolvedValue(events) },
    },
  };
}

function makeService(prisma: unknown) {
  return new AuditService(
    prisma as never,
    {} as never, // bullMq — not used by exportUserData
    {} as never, // redis — not used by exportUserData
  );
}

describe('AuditService.exportUserData', () => {
  it('returns events with ISO 8601 timestamps', async () => {
    const events = [
      {
        action: 'login',
        resource: 'auth',
        resourceId: 'sess-001',
        timestamp: new Date('2026-04-10T08:00:00.000Z'),
      },
    ];

    const prisma = makePrisma(events);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].action).toBe('login');
    expect(result.events[0].resource).toBe('auth');
    expect(result.events[0].resourceId).toBe('sess-001');
    expect(result.events[0].timestamp).toBe('2026-04-10T08:00:00.000Z');
  });

  it('uses { equals: userId } to handle nullable userId field', async () => {
    const prisma = makePrisma([]);
    const svc = makeService(prisma);

    await svc.exportUserData(USER_ID, TENANT_ID);

    expect(prisma.client.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: { equals: USER_ID }, tenantId: TENANT_ID },
      }),
    );
  });

  it('returns null resourceId when event has no resourceId', async () => {
    const events = [
      {
        action: 'view',
        resource: 'dashboard',
        resourceId: null,
        timestamp: new Date('2026-05-01T00:00:00.000Z'),
      },
    ];

    const prisma = makePrisma(events);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.events[0].resourceId).toBeNull();
  });

  it('returns empty events when user has no audit events', async () => {
    const prisma = makePrisma([]);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.events).toHaveLength(0);
  });

  it('returns events ordered by timestamp ascending', async () => {
    const events = [
      {
        action: 'view',
        resource: 'dashboard',
        resourceId: null,
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        action: 'login',
        resource: 'auth',
        resourceId: null,
        timestamp: new Date('2026-02-01T00:00:00.000Z'),
      },
    ];

    const prisma = makePrisma(events);
    const svc = makeService(prisma);

    const result = await svc.exportUserData(USER_ID, TENANT_ID);

    expect(result.events[0].timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(result.events[1].timestamp).toBe('2026-02-01T00:00:00.000Z');
  });
});
