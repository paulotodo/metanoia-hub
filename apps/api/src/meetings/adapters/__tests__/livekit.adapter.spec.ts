import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VideoProviderSignatureError } from '@metanoia/types';
import { LiveKitAdapter } from '../livekit.adapter';

// Mocked livekit-server-sdk surface — kept narrow so tests are unit-scoped.
const createRoomMock = vi.fn();
const deleteRoomMock = vi.fn();
const listParticipantsMock = vi.fn();
const webhookReceiveMock = vi.fn();
const addGrantMock = vi.fn();
const toJwtMock = vi.fn(() => 'jwt.body.sig');

vi.mock('livekit-server-sdk', () => {
  class RoomServiceClient {
    createRoom = createRoomMock;
    deleteRoom = deleteRoomMock;
    listParticipants = listParticipantsMock;
  }
  class WebhookReceiver {
    receive = webhookReceiveMock;
  }
  class AccessToken {
    addGrant = addGrantMock;
    toJwt = toJwtMock;
  }
  return { RoomServiceClient, WebhookReceiver, AccessToken };
});

function buildAdapter() {
  const config = {
    get: (key: string) => {
      const map: Record<string, string> = {
        LIVEKIT_API_KEY: 'devkey',
        LIVEKIT_API_SECRET: 'secret',
        LIVEKIT_URL: 'ws://localhost:7880',
      };
      return map[key]!;
    },
  };
  return new LiveKitAdapter(config as never);
}

const TENANT = '01912345-6789-7000-8000-000000000001';
const MEETING = '01912345-6789-7000-8000-000000000100';

describe('LiveKitAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toJwtMock.mockReturnValue('jwt.body.sig');
  });

  it('builds canonical room name {tenantId}:{meetingId}', () => {
    expect(buildAdapter().roomNameFor(TENANT, MEETING)).toBe(
      `${TENANT}:${MEETING}`,
    );
  });

  it('createRoom proxies SDK + returns ProviderRoom', async () => {
    createRoomMock.mockResolvedValue({ sid: 'RM_sid', name: `${TENANT}:${MEETING}` });
    const room = await buildAdapter().createRoom({
      roomName: `${TENANT}:${MEETING}`,
      maxParticipants: 50,
      emptyTimeoutSeconds: 600,
      metadata: { tenantId: TENANT, meetingId: MEETING },
    });
    expect(createRoomMock).toHaveBeenCalledWith({
      name: `${TENANT}:${MEETING}`,
      maxParticipants: 50,
      emptyTimeout: 600,
      metadata: JSON.stringify({ tenantId: TENANT, meetingId: MEETING }),
    });
    expect(room).toEqual({
      roomId: 'RM_sid',
      roomName: `${TENANT}:${MEETING}`,
      livekitUrl: 'ws://localhost:7880',
    });
  });

  it('deleteRoom swallows SDK errors (room may already be gone)', async () => {
    deleteRoomMock.mockRejectedValueOnce(new Error('not found'));
    await expect(
      buildAdapter().deleteRoom(`${TENANT}:${MEETING}`),
    ).resolves.toBeUndefined();
  });

  it('generateToken embeds metadata (tenantId) and grants roomJoin', async () => {
    const token = await buildAdapter().generateToken({
      roomName: `${TENANT}:${MEETING}`,
      identity: 'user-1',
      metadata: { tenantId: TENANT, meetingId: MEETING },
    });
    expect(addGrantMock).toHaveBeenCalledWith({
      roomJoin: true,
      room: `${TENANT}:${MEETING}`,
      canPublish: true,
      canSubscribe: true,
    });
    expect(token).toBe('jwt.body.sig');
  });

  it('getActiveParticipants normalises SDK shape', async () => {
    listParticipantsMock.mockResolvedValue([
      {
        identity: 'user-1',
        name: 'Lider',
        joinedAt: 1700000000n,
        metadata: 'X',
      },
    ]);
    const result = await buildAdapter().getActiveParticipants(
      `${TENANT}:${MEETING}`,
    );
    expect(result).toEqual([
      {
        identity: 'user-1',
        name: 'Lider',
        joinedAt: new Date(1700000000 * 1000).toISOString(),
        metadata: 'X',
      },
    ]);
  });

  it('getActiveParticipants returns [] when SDK throws', async () => {
    listParticipantsMock.mockRejectedValue(new Error('boom'));
    const result = await buildAdapter().getActiveParticipants('x:y');
    expect(result).toEqual([]);
  });

  describe('handleWebhook signature validation (NFR-S3)', () => {
    it('throws VideoProviderSignatureError when authorization header is missing', async () => {
      await expect(
        buildAdapter().handleWebhook(null, '{}'),
      ).rejects.toBeInstanceOf(VideoProviderSignatureError);
      expect(webhookReceiveMock).not.toHaveBeenCalled();
    });

    it('throws VideoProviderSignatureError when receive() rejects', async () => {
      webhookReceiveMock.mockRejectedValue(new Error('hmac mismatch'));
      await expect(
        buildAdapter().handleWebhook('Bearer xyz', '{}'),
      ).rejects.toBeInstanceOf(VideoProviderSignatureError);
    });

    it('parses participant_joined into typed event with providerEventId', async () => {
      webhookReceiveMock.mockResolvedValue({
        id: 'ev-lk-1',
        event: 'participant_joined',
        room: { name: `${TENANT}:${MEETING}`, sid: 'RM_sid' },
        participant: { identity: 'user-1', sid: 'PA_sid' },
      });
      const result = await buildAdapter().handleWebhook('Bearer xyz', '{}');
      expect(result).toMatchObject({
        type: 'participant.joined',
        providerEventId: 'ev-lk-1',
        tenantId: TENANT,
        meetingId: MEETING,
        participantIdentity: 'user-1',
        participantSid: 'PA_sid',
      });
    });

    it('parses participant_left into typed event', async () => {
      webhookReceiveMock.mockResolvedValue({
        event: 'participant_left',
        room: { name: `${TENANT}:${MEETING}`, sid: 'RM_sid' },
        participant: { identity: 'user-2', sid: null },
      });
      const result = await buildAdapter().handleWebhook('Bearer xyz', '{}');
      expect(result.type).toBe('participant.left');
    });

    it('parses room_started/room_finished into typed events', async () => {
      webhookReceiveMock
        .mockResolvedValueOnce({
          event: 'room_started',
          room: { name: `${TENANT}:${MEETING}`, sid: 'RM' },
        })
        .mockResolvedValueOnce({
          event: 'room_finished',
          room: { name: `${TENANT}:${MEETING}`, sid: 'RM' },
        });
      const a = await buildAdapter().handleWebhook('h', '{}');
      const b = await buildAdapter().handleWebhook('h', '{}');
      expect(a.type).toBe('room.started');
      expect(b.type).toBe('room.finished');
    });

    it('returns unknown event for unmapped SDK event types', async () => {
      webhookReceiveMock.mockResolvedValue({
        event: 'egress_started',
        room: { name: `${TENANT}:${MEETING}` },
      });
      const result = await buildAdapter().handleWebhook('h', '{}');
      expect(result).toMatchObject({ type: 'unknown', rawEvent: 'egress_started' });
    });

    it('parses track_published (video) into typed event with trackKind', async () => {
      webhookReceiveMock.mockResolvedValue({
        id: 'ev-tp',
        event: 'track_published',
        room: { name: `${TENANT}:${MEETING}` },
        participant: { identity: 'user-1' },
        track: { type: 'VIDEO' },
      });
      const result = await buildAdapter().handleWebhook('h', '{}');
      expect(result).toMatchObject({
        type: 'track.published',
        providerEventId: 'ev-tp',
        participantIdentity: 'user-1',
        trackKind: 'video',
      });
    });

    it('parses track_unpublished into typed event', async () => {
      webhookReceiveMock.mockResolvedValue({
        id: 'ev-tu',
        event: 'track_unpublished',
        room: { name: `${TENANT}:${MEETING}` },
        participant: { identity: 'user-1' },
        track: { type: 'AUDIO' },
      });
      const result = await buildAdapter().handleWebhook('h', '{}');
      expect(result).toMatchObject({
        type: 'track.unpublished',
        trackKind: 'audio',
      });
    });

    it('falls back to "unknown" trackKind when track field is missing', async () => {
      webhookReceiveMock.mockResolvedValue({
        event: 'track_published',
        room: { name: `${TENANT}:${MEETING}` },
        participant: { identity: 'user-1' },
      });
      const result = await buildAdapter().handleWebhook('h', '{}');
      expect(result).toMatchObject({ type: 'track.published', trackKind: 'unknown' });
    });

    it('returns null tenantId/meetingId when room name is malformed', async () => {
      webhookReceiveMock.mockResolvedValue({
        event: 'participant_joined',
        room: { name: 'malformed-room', sid: 'RM' },
        participant: { identity: 'user-1', sid: null },
      });
      const result = await buildAdapter().handleWebhook('h', '{}');
      expect(result.tenantId).toBeNull();
      expect(result.meetingId).toBeNull();
    });
  });
});
