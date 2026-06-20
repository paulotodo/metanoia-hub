import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPayload, NotificationResult } from '@metanoia/types';
import type { NotificationChannelInterface } from './notification-channel.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { getRequestContext } from '../../common/context/request-context';

/**
 * InAppChannel — updates notification status to `sent` in the DB and publishes
 * a realtime event to the Redis Pub/Sub channel `rt:notifications:{tenantId}:{userId}`.
 * The SSE consumer (Story 14.2a) subscribes to this channel.
 */
@Injectable()
export class InAppChannel implements NotificationChannelInterface {
  readonly channel = 'in_app' as const;
  private readonly logger = new Logger(InAppChannel.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const { tenantId } = getRequestContext();

      // Mark as sent inside tenant-scoped transaction (RLS enforced)
      await withTenantTx(this.prisma, async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE notifications
           SET status = 'sent'::"notification_status", updated_at = now()
           WHERE id = $1::uuid`,
          payload.notificationId,
        );
      });

      // Publish to Redis pub/sub (rt namespace — SSE consumer subscribes here)
      const realtimeChannel = `rt:notifications:${tenantId}:${payload.userId}`;
      const event = JSON.stringify({
        notificationId: payload.notificationId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        createdAt: new Date().toISOString(),
      });
      await this.redisService.publish(realtimeChannel, event);

      this.logger.log(
        { notificationId: payload.notificationId, userId: payload.userId, channel: realtimeChannel },
        'in-app notification sent',
      );

      return { success: true };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(
        { notificationId: payload.notificationId, error: message },
        'in-app notification failed',
      );
      return { success: false, error: message };
    }
  }
}
