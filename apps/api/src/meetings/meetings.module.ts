import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsentModule } from '../consent/consent.module';
import { LiveKitWebhookController } from './webhooks/livekit-webhook.controller';
import { MeetingEventService } from './events/meeting-event.service';
import { MeetingEventWorker } from './events/meeting-event.worker';
import { MeetingSseController } from './sse/meeting-sse.controller';
import { MeetingSseService } from './sse/meeting-sse.service';
import { AttendanceLiveController } from './sse/attendance-live.controller';
import { AttendanceLiveService } from './sse/attendance-live.service';
import { MeetingRoleGuard } from './guards/meeting-role.guard';
import { TelemetryService } from './telemetry/telemetry.service';
import { TelemetryRepository } from './telemetry/telemetry.repository';
import { FocusHeartbeatController } from './telemetry/focus-heartbeat.controller';
import { ReportService } from './reports/report.service';
import { ReportRepository } from './reports/report.repository';
import { ReportController } from './reports/report.controller';
import { MeetingReminderService } from './notifications/meeting-reminder.service';
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
  imports: [PrismaModule, ConsentModule],
  controllers: [
    LiveKitWebhookController,
    MeetingSseController,
    AttendanceLiveController,
    FocusHeartbeatController,
    ReportController,
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
    AttendanceLiveService,
    MeetingRoleGuard,
    TelemetryService,
    TelemetryRepository,
    ReportService,
    ReportRepository,
    MeetingReminderService,
  ],
  exports: [
    MeetingsService,
    LiveKitAdapter,
    VIDEO_PROVIDER_ADAPTER,
    PresenceService,
  ],
})
export class MeetingsModule {}
