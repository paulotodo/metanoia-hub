import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestContext } from '../../../common/context/request-context';
import { generateId } from '@metanoia/types';
import { MeetingEventService } from '../meeting-event.service';

/**
 * Story 5.2 AC4 — webhooks from tenant A must not feed cache of tenant B.
 *
 * Pure unit assertion on the Redis namespace contract:
 * - Presence key: `rt:meeting:{tenantId}:{meetingId}:presence`
 * - Events channel: `rt:meeting:{tenantId}:{meetingId}:events`
 *
 * Two parallel calls under different RequestContexts must hit distinct keys.
 */
function buildService() {
  const redis = {
    hset: vi.fn().mockResolvedValue(1),
    publish: vi.fn().mockResolvedValue(1),
  };
  const queueAdd = vi.fn().mockResolvedValue({ id: 'job-id' });
  const bullMqService = {
    createQueue: vi.fn(() => ({ add: queueAdd })),
  };
  const service = new MeetingEventService(redis as never, bullMqService as never);
  return { service, redis, queueAdd };
}

const TENANT_A = '01912345-6789-7000-8000-000000000001';
const TENANT_B = '01912345-6789-7000-8000-000000000002';
const MEETING_A = '01912345-6789-7000-8000-00000000000a';
const MEETING_B = '01912345-6789-7000-8000-00000000000b';

async function withCtx(tenantId: string, fn: () => Promise<void>) {
  return requestContext.run(
    {
      tenantId,
      userId: generateId(),
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe('Multi-tenant Redis isolation (AC4)', () => {
  let env: ReturnType<typeof buildService>;

  beforeEach(() => {
    env = buildService();
  });

  it('namespaces presence by tenantId — no cross-tenant key collision', async () => {
    await withCtx(TENANT_A, async () => {
      await env.service.handleParticipantJoined({
        meetingId: MEETING_A,
        userId: 'user-1',
        eventType: 'meetings.participant.joined',
        payload: {},
      });
    });

    await withCtx(TENANT_B, async () => {
      await env.service.handleParticipantJoined({
        meetingId: MEETING_B,
        userId: 'user-2',
        eventType: 'meetings.participant.joined',
        payload: {},
      });
    });

    const presenceKeys = env.redis.hset.mock.calls.map((c) => c[0] as string);
    expect(presenceKeys).toEqual([
      `rt:meeting:${TENANT_A}:${MEETING_A}:presence`,
      `rt:meeting:${TENANT_B}:${MEETING_B}:presence`,
    ]);

    // Each presence key contains the tenantId — assert no leakage
    expect(presenceKeys[0]).toContain(TENANT_A);
    expect(presenceKeys[0]).not.toContain(TENANT_B);
    expect(presenceKeys[1]).toContain(TENANT_B);
    expect(presenceKeys[1]).not.toContain(TENANT_A);
  });

  it('namespaces event channel by tenantId — pub/sub stays per-tenant', async () => {
    await withCtx(TENANT_A, async () => {
      await env.service.handleParticipantJoined({
        meetingId: MEETING_A,
        userId: 'user-1',
        eventType: 'meetings.participant.joined',
        payload: {},
      });
    });
    await withCtx(TENANT_B, async () => {
      await env.service.handleParticipantJoined({
        meetingId: MEETING_B,
        userId: 'user-2',
        eventType: 'meetings.participant.joined',
        payload: {},
      });
    });

    const channels = env.redis.publish.mock.calls.map((c) => c[0] as string);
    expect(channels).toEqual([
      `rt:meeting:${TENANT_A}:${MEETING_A}:events`,
      `rt:meeting:${TENANT_B}:${MEETING_B}:events`,
    ]);
  });

  it('BullMQ job payload carries tenantId so workers respect tenant boundary', async () => {
    await withCtx(TENANT_A, async () => {
      await env.service.handleParticipantJoined({
        meetingId: MEETING_A,
        userId: 'user-1',
        eventType: 'meetings.participant.joined',
        payload: {},
      });
    });

    const job = env.queueAdd.mock.calls[0]![1] as { tenantId: string };
    expect(job.tenantId).toBe(TENANT_A);
  });
});
