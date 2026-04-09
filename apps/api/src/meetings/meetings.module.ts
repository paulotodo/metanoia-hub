import { Module } from '@nestjs/common';
import { LiveKitWebhookController } from './webhooks/livekit-webhook.controller';
import { MeetingEventService } from './events/meeting-event.service';
import { MeetingEventWorker } from './events/meeting-event.worker';
import { MeetingSseController } from './sse/meeting-sse.controller';
import { MeetingSseService } from './sse/meeting-sse.service';

@Module({
  controllers: [LiveKitWebhookController, MeetingSseController],
  providers: [MeetingEventService, MeetingEventWorker, MeetingSseService],
})
export class MeetingsModule {}
