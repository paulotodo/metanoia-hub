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
import { EmailService } from './channels/email.service';
import { EmailRateLimiterService } from './email-rate-limiter.service';
import { EmailCircuitBreakerService } from './email-circuit-breaker.service';
import { EMAIL_HEALTH_PORT, StubEmailHealthPort } from './ports/email-health.port';
import { DigestService } from './digest.service';
import { TenantsModule } from '../tenants/tenants.module';

/**
 * NotificationsModule — Story 14-1 + Story 14-3 (email channel) infrastructure.
 *
 * Exports NotificationsService so other modules (e.g., PastoralModule,
 * MeetingsModule) can inject and call dispatch() to send notifications.
 *
 * BullMqModule and RedisModule are global — no need to import them here.
 *
 * EMAIL_HEALTH_PORT: injected as StubEmailHealthPort until Story 14-4 implements
 * the real health probe against Resend API. (SC-07: swappable without changing EmailChannel.)
 */
@Module({
  imports: [
    // BrandingService lives in TenantsModule — import to make it injectable here.
    TenantsModule,
  ],
  providers: [
    // Core
    NotificationsService,
    NotificationsWorker,
    ChannelRouter,
    DigestService,
    // Channels
    InAppChannel,
    EmailChannel,      // Story 14-3: real implementation (replaces stub from 14-1)
    EmailService,      // Story 14-3: Resend SDK abstraction
    // Email infrastructure
    EmailRateLimiterService,     // Story 14-3: Lua atomic rate limiter
    EmailCircuitBreakerService,  // Story 14-3: Redis-backed circuit breaker
    // Ports (INTEGRATION POINT: Story 14-4 replaces StubEmailHealthPort)
    {
      provide: EMAIL_HEALTH_PORT,
      useClass: StubEmailHealthPort,
    },
    // SSE
    SseConnectionManager,
    SseRedisService,
  ],
  controllers: [NotificationsController, SseController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
