import { describe, it, expect, vi } from 'vitest';
import { InAppChannel } from './in-app.channel';
import { requestContext } from '../../common/context/request-context';

function makeMocks() {
  const executeRawUnsafe = vi.fn().mockResolvedValue(1);
  const prisma = {
    client: {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) =>
        fn({ $executeRawUnsafe: executeRawUnsafe }),
      ),
    },
  };
  const redisService = {
    publish: vi.fn().mockResolvedValue(1),
  };
  return { prisma, redisService, executeRawUnsafe };
}

const TENANT_ID = '019756c0-0002-7000-8000-000000000001';
const USER_ID   = '019756c0-0002-7000-8000-000000000002';
const NOTIF_ID  = '019756c0-0002-7000-8000-000000000003';

const basePayload = {
  notificationId: NOTIF_ID,
  tenantId: TENANT_ID,
  userId: USER_ID,
  channel: 'in_app' as const,
  type: 'group_message' as const,
  title: 'Nova mensagem',
  body: 'Paulo enviou uma mensagem',
};

describe('InAppChannel', () => {
  it('has channel = in_app', () => {
    const { prisma, redisService } = makeMocks();
    const channel = new InAppChannel(prisma as any, redisService as any);
    expect(channel.channel).toBe('in_app');
  });

  it('updates status to sent and publishes to correct Redis channel', async () => {
    const { prisma, redisService, executeRawUnsafe } = makeMocks();
    const channel = new InAppChannel(prisma as any, redisService as any);

    const result = await requestContext.run(
      { tenantId: TENANT_ID, userId: USER_ID, requestId: 'req-1', correlationId: 'corr-1' },
      () => channel.send(basePayload),
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // Verify status update SQL was called
    expect(executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notifications'),
      NOTIF_ID,
    );

    // Verify Redis publish to correct channel
    const expectedChannel = `rt:notifications:${TENANT_ID}:${USER_ID}`;
    expect(redisService.publish).toHaveBeenCalledWith(
      expectedChannel,
      expect.stringContaining(NOTIF_ID),
    );
  });

  it('returns success: false with error message on exception', async () => {
    const { prisma, redisService } = makeMocks();
    prisma.client.$transaction.mockRejectedValue(new Error('DB connection lost'));
    const channel = new InAppChannel(prisma as any, redisService as any);

    const result = await requestContext.run(
      { tenantId: TENANT_ID, userId: USER_ID, requestId: 'req-2', correlationId: 'corr-2' },
      () => channel.send(basePayload),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB connection lost');
  });

  it('published event contains notificationId and createdAt ISO string', async () => {
    const { prisma, redisService } = makeMocks();
    const channel = new InAppChannel(prisma as any, redisService as any);

    await requestContext.run(
      { tenantId: TENANT_ID, userId: USER_ID, requestId: 'req-3', correlationId: 'corr-3' },
      () => channel.send(basePayload),
    );

    const [, publishedPayload] = redisService.publish.mock.calls[0] as [string, string];
    const parsed = JSON.parse(publishedPayload) as Record<string, unknown>;
    expect(parsed.notificationId).toBe(NOTIF_ID);
    expect(typeof parsed.createdAt).toBe('string');
    // Should be ISO 8601
    expect(new Date(parsed.createdAt as string).toISOString()).toBe(parsed.createdAt);
  });
});
