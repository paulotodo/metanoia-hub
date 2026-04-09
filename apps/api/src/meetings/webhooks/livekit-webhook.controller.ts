import {
  Controller,
  Post,
  Headers,
  RawBody,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookReceiver } from 'livekit-server-sdk';
import { Public } from '../../auth/decorators/public.decorator';
import { requestContext } from '../../common/context/request-context';
import { generateId } from '@metanoia/types';
import { MeetingEventService } from '../events/meeting-event.service';
import type { EnvConfig } from '../../config/env.validation';

@Controller('api/v1/webhooks')
export class LiveKitWebhookController {
  private readonly logger = new Logger(LiveKitWebhookController.name);
  private readonly webhookReceiver: WebhookReceiver;

  constructor(
    private readonly meetingEventService: MeetingEventService,
    configService: ConfigService<EnvConfig, true>,
  ) {
    this.webhookReceiver = new WebhookReceiver(
      configService.get('LIVEKIT_API_KEY', { infer: true }),
      configService.get('LIVEKIT_API_SECRET', { infer: true }),
    );
  }

  @Public()
  @Post('livekit')
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('authorization') authHeader: string,
  ): Promise<{ data: { received: boolean } }> {
    const startTime = performance.now();

    if (!authHeader) {
      throw new BadRequestException('Missing authorization header');
    }

    // Verify HMAC signature
    const body = rawBody.toString('utf-8');
    let event;
    try {
      event = await this.webhookReceiver.receive(body, authHeader);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.event !== 'participant_joined') {
      this.logger.log({ event: event.event }, 'ignoring non-participant_joined event');
      return { data: { received: true } };
    }

    // Extract tenantId and meetingId from room name convention: {tenantId}:{meetingId}
    const roomName = event.room?.name;
    if (!roomName) {
      throw new BadRequestException('Missing room name in webhook event');
    }

    const parts = roomName.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new BadRequestException(
        'Room name must follow convention {tenantId}:{meetingId}',
      );
    }

    const [tenantId, meetingId] = parts;
    const userId = event.participant?.identity ?? 'anonymous';

    this.logger.log(
      { tenantId, meetingId, userId, eventType: event.event },
      'livekit webhook received',
    );

    // Manually populate RequestContext (webhook is server-to-server, no JWT)
    await requestContext.run(
      {
        tenantId,
        userId,
        requestId: generateId(),
        correlationId: generateId(),
      },
      async () => {
        await this.meetingEventService.handleParticipantJoined({
          meetingId,
          userId,
          eventType: `meetings.participant.joined`,
          payload: {
            roomSid: event.room?.sid,
            participantSid: event.participant?.sid,
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
