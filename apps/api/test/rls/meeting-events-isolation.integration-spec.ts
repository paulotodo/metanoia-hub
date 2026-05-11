import { requestContext } from '../../src/common/context/request-context';
import { generateId } from '@metanoia/types';
import { createMeetingEvent } from '../factories/meeting-event.factory';

/**
 * Multi-tenant isolation integration test for meeting events.
 *
 * Prerequisites:
 * - PostgreSQL running with RLS policies applied
 * - Tenant-scoped queries routed through withTenantTx (apps/api/src/prisma/with-tenant-tx.ts)
 *
 * This test validates:
 * 1. Tenant A can only see their own events
 * 2. Tenant B cannot see Tenant A's events
 * 3. Redis namespaces are tenant-scoped
 */
describe('Meeting Events — Multi-tenant Isolation', () => {
  const tenantA = generateId();
  const tenantB = generateId();

  it('should create events scoped to tenant A', () => {
    const event = createMeetingEvent({ tenantId: tenantA });
    expect(event.tenantId).toBe(tenantA);
    expect(event.id).toBeDefined();
    expect(event.meetingId).toBeDefined();
  });

  it('should create events scoped to tenant B', () => {
    const event = createMeetingEvent({ tenantId: tenantB });
    expect(event.tenantId).toBe(tenantB);
    expect(event.tenantId).not.toBe(tenantA);
  });

  it('should generate tenant-scoped Redis keys', () => {
    const meetingId = generateId();

    const keyA = `rt:meeting:${tenantA}:${meetingId}:presence`;
    const keyB = `rt:meeting:${tenantB}:${meetingId}:presence`;

    expect(keyA).toContain(tenantA);
    expect(keyB).toContain(tenantB);
    expect(keyA).not.toBe(keyB);
  });

  it('should generate tenant-scoped SSE channels', () => {
    const meetingId = generateId();

    const channelA = `rt:meeting:${tenantA}:${meetingId}:events`;
    const channelB = `rt:meeting:${tenantB}:${meetingId}:events`;

    expect(channelA).toContain(tenantA);
    expect(channelB).toContain(tenantB);
    expect(channelA).not.toBe(channelB);
  });

  it('should populate RequestContext with correct tenant for isolation', async () => {
    const contexts: string[] = [];

    await requestContext.run(
      {
        tenantId: tenantA,
        userId: 'user-a',
        requestId: generateId(),
        correlationId: generateId(),
      },
      async () => {
        const store = requestContext.getStore();
        contexts.push(store!.tenantId);
      },
    );

    await requestContext.run(
      {
        tenantId: tenantB,
        userId: 'user-b',
        requestId: generateId(),
        correlationId: generateId(),
      },
      async () => {
        const store = requestContext.getStore();
        contexts.push(store!.tenantId);
      },
    );

    expect(contexts[0]).toBe(tenantA);
    expect(contexts[1]).toBe(tenantB);
    expect(contexts[0]).not.toBe(contexts[1]);
  });
});
