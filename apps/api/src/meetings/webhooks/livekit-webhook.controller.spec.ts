import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { VideoProviderSignatureError } from '@metanoia/types';
import { LiveKitWebhookController } from './livekit-webhook.controller';

const TENANT = '01912345-6789-7000-8000-000000000001';
const MEETING = '01912345-6789-7000-8000-000000000100';

function build() {
  const meetingEventService = {
    handleParticipantJoined: vi.fn().mockResolvedValue(undefined),
    handleParticipantLeft: vi.fn().mockResolvedValue(undefined),
  };
  const videoProvider = {
    handleWebhook: vi.fn(),
    roomNameFor: vi.fn(),
    getProviderUrl: vi.fn(),
    createRoom: vi.fn(),
    deleteRoom: vi.fn(),
    generateToken: vi.fn(),
    getActiveParticipants: vi.fn(),
  };
  const controller = new LiveKitWebhookController(
    meetingEventService as never,
    videoProvider as never,
  );
  return { controller, meetingEventService, videoProvider };
}

describe('LiveKitWebhookController', () => {
  let env: ReturnType<typeof build>;

  beforeEach(() => {
    env = build();
  });

  it('returns 401 (UnauthorizedException) when adapter reports invalid signature', async () => {
    env.videoProvider.handleWebhook.mockRejectedValue(
      new VideoProviderSignatureError('Invalid webhook signature'),
    );

    await expect(
      env.controller.handleWebhook(Buffer.from('{}'), 'Bearer bogus'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(env.meetingEventService.handleParticipantJoined).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header missing (adapter still throws SignatureError)', async () => {
    env.videoProvider.handleWebhook.mockRejectedValue(
      new VideoProviderSignatureError('Missing authorization header'),
    );

    await expect(
      env.controller.handleWebhook(Buffer.from('{}'), undefined as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ignores non-participant.joined events with 200', async () => {
    env.videoProvider.handleWebhook.mockResolvedValue({
      type: 'room.started',
      roomName: `${TENANT}:${MEETING}`,
      tenantId: TENANT,
      meetingId: MEETING,
      providerEventId: 'ev-test',
      timestamp: '2026-04-20T19:30:00.000Z',
      roomId: 'RM',
    });
    const out = await env.controller.handleWebhook(
      Buffer.from('{}'),
      'Bearer ok',
    );
    expect(out).toEqual({ data: { received: true } });
    expect(env.meetingEventService.handleParticipantJoined).not.toHaveBeenCalled();
  });

  it('rejects participant.joined with malformed room name (null tenant/meeting) with 400', async () => {
    env.videoProvider.handleWebhook.mockResolvedValue({
      type: 'participant.joined',
      roomName: 'bad-room',
      tenantId: null,
      meetingId: null,
      providerEventId: 'ev-test',
      timestamp: '2026-04-20T19:30:00.000Z',
      participantIdentity: 'u',
      participantSid: null,
    });
    await expect(
      env.controller.handleWebhook(Buffer.from('{}'), 'Bearer ok'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hydrates RequestContext and forwards typed event to MeetingEventService', async () => {
    env.videoProvider.handleWebhook.mockResolvedValue({
      type: 'participant.joined',
      roomName: `${TENANT}:${MEETING}`,
      tenantId: TENANT,
      meetingId: MEETING,
      providerEventId: 'ev-test',
      timestamp: '2026-04-20T19:30:00.000Z',
      participantIdentity: 'user-1',
      participantSid: 'PA',
    });

    await env.controller.handleWebhook(Buffer.from('{}'), 'Bearer ok');

    expect(env.meetingEventService.handleParticipantJoined).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: MEETING,
        userId: 'user-1',
        eventType: 'meetings.participant.joined',
        payload: { participantSid: 'PA' },
        providerEventId: 'ev-test',
      }),
    );
  });

  it('forwards participant.left events to handleParticipantLeft (Story 5.3)', async () => {
    env.videoProvider.handleWebhook.mockResolvedValue({
      type: 'participant.left',
      providerEventId: 'ev-left',
      roomName: `${TENANT}:${MEETING}`,
      tenantId: TENANT,
      meetingId: MEETING,
      timestamp: '2026-04-20T19:30:00.000Z',
      participantIdentity: 'user-1',
      participantSid: 'PA',
    });

    await env.controller.handleWebhook(Buffer.from('{}'), 'Bearer ok');

    expect(env.meetingEventService.handleParticipantLeft).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: MEETING,
        userId: 'user-1',
        providerEventId: 'ev-left',
      }),
    );
    expect(env.meetingEventService.handleParticipantJoined).not.toHaveBeenCalled();
  });
});
