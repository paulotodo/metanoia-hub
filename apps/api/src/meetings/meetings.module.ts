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
import { LivekitService } from './livekit/livekit.service';

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
    LivekitService,
  ],
  exports: [MeetingsService, LivekitService],
})
export class MeetingsModule {}
