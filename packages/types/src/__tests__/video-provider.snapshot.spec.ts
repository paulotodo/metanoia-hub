import { describe, expect, it } from 'vitest';
import {
  CreateRoomOptionsSchema,
  GenerateTokenOptionsSchema,
  ProviderRoomSchema,
  ProviderParticipantSchema,
  VideoProviderEventSchema,
  VideoProviderEventTypeSchema,
  VideoProviderSignatureError,
} from '../video-provider';

describe('CreateRoomOptionsSchema snapshot', () => {
  it('accepts minimum required fields and rejects bad input', () => {
    const ok = CreateRoomOptionsSchema.safeParse({
      roomName: 'tenant-a:meeting-1',
    });
    const empty = CreateRoomOptionsSchema.safeParse({ roomName: '' });
    const tooMany = CreateRoomOptionsSchema.safeParse({
      roomName: 'x',
      maxParticipants: 999,
    });
    expect({ ok: ok.success, empty: !empty.success, tooMany: !tooMany.success })
      .toEqual({ ok: true, empty: true, tooMany: true });
  });
});

describe('GenerateTokenOptionsSchema snapshot', () => {
  it('accepts metadata as Record<string,string>', () => {
    const ok = GenerateTokenOptionsSchema.safeParse({
      roomName: 'tenant-a:meeting-1',
      identity: 'user-1',
      metadata: { tenantId: 'tenant-a', meetingId: 'meeting-1' },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects empty identity', () => {
    const fail = GenerateTokenOptionsSchema.safeParse({
      roomName: 'x',
      identity: '',
    });
    expect(fail.success).toBe(false);
  });
});

describe('ProviderRoomSchema snapshot', () => {
  it('freezes the room shape', () => {
    const ok = ProviderRoomSchema.safeParse({
      roomId: 'RM_sid',
      roomName: 'tenant-a:meeting-1',
      livekitUrl: 'ws://localhost:7880',
    });
    expect(ok.success).toBe(true);
  });
});

describe('ProviderParticipantSchema snapshot', () => {
  it('allows null name/joinedAt/metadata', () => {
    const ok = ProviderParticipantSchema.safeParse({
      identity: 'user-1',
      name: null,
      joinedAt: null,
      metadata: null,
    });
    expect(ok.success).toBe(true);
  });
});

describe('VideoProviderEventSchema snapshot', () => {
  it('parses participant.joined event', () => {
    const ok = VideoProviderEventSchema.safeParse({
      type: 'participant.joined',
      roomName: 'tenant-a:meeting-1',
      tenantId: '019756c0-0002-7000-8000-000000000001',
      meetingId: '019756c0-0002-7000-8000-000000000002',
      timestamp: '2026-04-20T19:30:00.000Z',
      participantIdentity: 'user-1',
      participantSid: 'PA_sid',
    });
    expect(ok.success).toBe(true);
  });

  it('parses room.started event', () => {
    const ok = VideoProviderEventSchema.safeParse({
      type: 'room.started',
      roomName: 'tenant-a:meeting-1',
      tenantId: '019756c0-0002-7000-8000-000000000001',
      meetingId: '019756c0-0002-7000-8000-000000000002',
      timestamp: '2026-04-20T19:30:00.000Z',
      roomId: 'RM_sid',
    });
    expect(ok.success).toBe(true);
  });

  it('parses unknown event', () => {
    const ok = VideoProviderEventSchema.safeParse({
      type: 'unknown',
      roomName: 'tenant-a:meeting-1',
      tenantId: null,
      meetingId: null,
      timestamp: '2026-04-20T19:30:00.000Z',
      rawEvent: 'egress_started',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects participant.joined missing participantIdentity', () => {
    const fail = VideoProviderEventSchema.safeParse({
      type: 'participant.joined',
      roomName: 'x:y',
      tenantId: null,
      meetingId: null,
      timestamp: '2026-04-20T19:30:00.000Z',
    });
    expect(fail.success).toBe(false);
  });
});

describe('VideoProviderEventTypeSchema snapshot', () => {
  it('freezes the enum values', () => {
    expect(VideoProviderEventTypeSchema.options).toMatchInlineSnapshot(`
      [
        "room.started",
        "room.finished",
        "participant.joined",
        "participant.left",
        "unknown",
      ]
    `);
  });
});

describe('VideoProviderSignatureError', () => {
  it('has the expected name + default message', () => {
    const err = new VideoProviderSignatureError();
    expect(err.name).toBe('VideoProviderSignatureError');
    expect(err.message).toBe('Invalid webhook signature');
    expect(err).toBeInstanceOf(Error);
  });
});
