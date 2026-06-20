import { describe, it, expect, vi } from 'vitest';
import { DigestService } from './digest.service';
import {
  NOTIFICATIONS_QUEUE_NAME,
  NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS,
} from '@metanoia/types';

function createMocks() {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  };
  const bullMqService = {
    createQueue: vi.fn().mockReturnValue(mockQueue),
  };
  const configService = {
    get: vi.fn().mockReturnValue(NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS),
  };
  return { mockQueue, bullMqService, configService };
}

describe('DigestService', () => {
  const userId = '019756c0-0002-7000-8000-000000000001';
  const tenantId = '019756c0-0002-7000-8000-000000000002';
  const notificationId = '019756c0-0002-7000-8000-000000000003';
  const correlationId = 'corr-test-123';

  describe('onModuleInit', () => {
    it('creates the notifications queue', () => {
      const { bullMqService, configService } = createMocks();
      const service = new DigestService(bullMqService as any, configService as any);
      service.onModuleInit();
      expect(bullMqService.createQueue).toHaveBeenCalledWith(NOTIFICATIONS_QUEUE_NAME);
    });
  });

  describe('enqueue — pastoral_alert', () => {
    it('enqueues immediately without delay or jobId', async () => {
      const { mockQueue, bullMqService, configService } = createMocks();
      const service = new DigestService(bullMqService as any, configService as any);
      service.onModuleInit();

      await service.enqueue(notificationId, userId, tenantId, 'pastoral_alert', 'in_app', correlationId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification',
        expect.objectContaining({ notificationId, tenantId, userId, channel: 'in_app', correlationId }),
        expect.not.objectContaining({ delay: expect.anything() }),
      );
      const callArgs = mockQueue.add.mock.calls[0][2];
      expect(callArgs.jobId).toBeUndefined();
    });
  });

  describe('enqueue — non-urgent (group_message)', () => {
    it('enqueues with delay and deterministic jobId', async () => {
      const { mockQueue, bullMqService, configService } = createMocks();
      const service = new DigestService(bullMqService as any, configService as any);
      service.onModuleInit();

      await service.enqueue(notificationId, userId, tenantId, 'group_message', 'in_app', correlationId);

      const callArgs = mockQueue.add.mock.calls[0][2];
      expect(callArgs.delay).toBe(NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS);
      expect(callArgs.jobId).toMatch(/^digest:/);
      expect(callArgs.jobId).toContain(userId);
      expect(callArgs.jobId).toContain('group_message');
    });

    it('two dispatches in the same bucket use the same jobId (deduplication)', async () => {
      const { mockQueue, bullMqService, configService } = createMocks();
      const service = new DigestService(bullMqService as any, configService as any);
      service.onModuleInit();

      const notif2 = '019756c0-0002-7000-8000-000000000004';
      await service.enqueue(notificationId, userId, tenantId, 'group_message', 'in_app', correlationId);
      await service.enqueue(notif2, userId, tenantId, 'group_message', 'in_app', 'corr-2');

      const jobId1 = mockQueue.add.mock.calls[0][2].jobId;
      const jobId2 = mockQueue.add.mock.calls[1][2].jobId;
      expect(jobId1).toBe(jobId2);
    });

    it('uses configured digest window from configService', async () => {
      const { mockQueue, bullMqService, configService } = createMocks();
      const customWindow = 60000;
      configService.get.mockReturnValue(customWindow);
      const service = new DigestService(bullMqService as any, configService as any);
      service.onModuleInit();

      await service.enqueue(notificationId, userId, tenantId, 'content_update', 'email', correlationId);

      const callArgs = mockQueue.add.mock.calls[0][2];
      expect(callArgs.delay).toBe(customWindow);
    });

    it('pastoral_alert and group_message in same invocation: alert has no delay', async () => {
      const { mockQueue, bullMqService, configService } = createMocks();
      const service = new DigestService(bullMqService as any, configService as any);
      service.onModuleInit();

      await service.enqueue('notif-alert', userId, tenantId, 'pastoral_alert', 'in_app', 'corr-a');
      await service.enqueue('notif-group', userId, tenantId, 'group_message', 'in_app', 'corr-b');

      const alertArgs = mockQueue.add.mock.calls[0][2];
      const groupArgs = mockQueue.add.mock.calls[1][2];

      expect(alertArgs.jobId).toBeUndefined();
      expect(alertArgs.delay).toBeUndefined();
      expect(groupArgs.delay).toBe(NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS);
    });
  });
});
