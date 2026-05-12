import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LiveKitWebhookController } from './webhooks/livekit-webhook.controller';
import { MeetingEventService } from './events/meeting-event.service';
import { MeetingEventWorker } from './events/meeting-event.worker';
import { MeetingSseController } from './sse/meeting-sse.controller';
import { MeetingSseService } from './sse/meeting-sse.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsRepository } from './meetings.repository';
import { ReflectionsController } from './reflections.controller';
import { ReflectionsService } from './reflections.service';
import { ReflectionsRepository } from './reflections.repository';
import { LiveKitAdapter } from './adapters/livekit.adapter';
import { VIDEO_PROVIDER_ADAPTER } from './adapters/video-provider.adapter';
import { PresenceService } from './presence/presence.service';
import { PresenceRepository } from './presence/presence.repository';
import { PresenceCheckpointService } from './presence/presence-checkpoint.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    LiveKitWebhookController,
    MeetingSseController,
    MeetingsController,
    ReflectionsController,
  ],
  providers: [
    MeetingEventService,
    MeetingEventWorker,
    MeetingSseService,
    MeetingsService,
    MeetingsRepository,
    ReflectionsService,
    ReflectionsRepository,
    LiveKitAdapter,
    { provide: VIDEO_PROVIDER_ADAPTER, useExisting: LiveKitAdapter },
    PresenceService,
    PresenceRepository,
    PresenceCheckpointService,
  ],
  exports: [
    MeetingsService,
    LiveKitAdapter,
    VIDEO_PROVIDER_ADAPTER,
    PresenceService,
  ],
})
export class MeetingsModule {}
