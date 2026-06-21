import { Module } from '@nestjs/common';
import { SseController } from './sse/sse.controller';
import { SseConnectionManager } from './sse/sse-connection.manager';
import { SseRedisService } from './sse/sse-redis.service';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsWorker } from './notifications.worker';
import { ChannelRouter } from './channel-router';
import { InAppChannel } from './channels/in-app.channel';
import { EmailChannel } from './channels/email.channel';
import { DigestService } from './digest.service';

/**
 * NotificationsModule — Story 14-1 (FR77) infrastructure.
 *
 * Exports NotificationsService so other modules (e.g., PastoralModule,
 * MeetingsModule) can inject and call dispatch() to send notifications.
 *
 * BullMqModule and RedisModule are global — no need to import them here.
 */
@Module({
  providers: [
    NotificationsService,
    NotificationsWorker,
    ChannelRouter,
    InAppChannel,
    EmailChannel,
    DigestService,
    SseConnectionManager,
    SseRedisService,
  ],
  controllers: [NotificationsController, SseController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
