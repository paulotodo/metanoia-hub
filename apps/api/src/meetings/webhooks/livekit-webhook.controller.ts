import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Logger,
  Post,
  RawBody,
  UnauthorizedException,
} from '@nestjs/common';
import { VideoProviderSignatureError, generateId } from '@metanoia/types';
import { Public } from '../../auth/decorators/public.decorator';
import { requestContext } from '../../common/context/request-context';
import {
  VIDEO_PROVIDER_ADAPTER,
  type VideoProviderAdapter,
} from '../adapters/video-provider.adapter';
import { MeetingEventService } from '../events/meeting-event.service';

/**
 * Story 5.2 — webhook surface for the active video provider. The controller
 * stays thin: signature validation + payload parsing live in the adapter
 * (`handleWebhook`), so swapping providers is contained.
 *
 * Returns HTTP 401 when the adapter raises `VideoProviderSignatureError`
 * (NFR-S3 — reject unsigned/invalid webhooks).
 */
@Controller('api/v1/webhooks')
export class LiveKitWebhookController {
  private readonly logger = new Logger(LiveKitWebhookController.name);

  constructor(
    private readonly meetingEventService: MeetingEventService,
    @Inject(VIDEO_PROVIDER_ADAPTER)
    private readonly videoProvider: VideoProviderAdapter,
  ) {}

  @Public()
  @Post('livekit')
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('authorization') authHeader: string,
  ): Promise<{ data: { received: boolean } }> {
    const startTime = performance.now();

    let event;
    try {
      event = await this.videoProvider.handleWebhook(
        authHeader ?? null,
        rawBody.toString('utf-8'),
      );
    } catch (error) {
      if (error instanceof VideoProviderSignatureError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }

    if (event.type !== 'participant.joined') {
      this.logger.log({ eventType: event.type }, 'ignoring non-join event');
      return { data: { received: true } };
    }

    if (!event.tenantId || !event.meetingId) {
      throw new BadRequestException(
        'Room name must follow convention {tenantId}:{meetingId}',
      );
    }

    const { tenantId, meetingId, participantIdentity, participantSid } = event;

    this.logger.log(
      { tenantId, meetingId, userId: participantIdentity, eventType: event.type },
      'video provider webhook received',
    );

    // Webhook is server-to-server (no JWT) — populate RequestContext manually.
    await requestContext.run(
      {
        tenantId,
        userId: participantIdentity,
        requestId: generateId(),
        correlationId: generateId(),
      },
      async () => {
        await this.meetingEventService.handleParticipantJoined({
          meetingId,
          userId: participantIdentity,
          eventType: 'meetings.participant.joined',
          payload: {
            participantSid,
          },
        });
      },
    );

    const elapsed = performance.now() - startTime;
    this.logger.log(
      { tenantId, meetingId, elapsedMs: Math.round(elapsed * 100) / 100 },
      'webhook pipeline completed',
    );

    return { data: { received: true } };
  }
}
