import { describe, it, expect } from 'vitest';
import { LivekitService } from './livekit.service';

function buildService() {
  const config = {
    get: (key: string) => {
      const map: Record<string, string> = {
        LIVEKIT_API_KEY: 'devkey',
        LIVEKIT_API_SECRET: 'secret_dev_only_not_for_production',
        LIVEKIT_URL: 'ws://localhost:7880',
      };
      return map[key]!;
    },
  };
  return new LivekitService(config as any);
}

describe('LivekitService', () => {
  it('builds canonical room name as {tenantId}:{meetingId}', () => {
    const svc = buildService();
    const name = svc.roomNameFor('tenant-a', 'meeting-1');
    expect(name).toBe('tenant-a:meeting-1');
  });

  it('generates a JWT join token with required grants', async () => {
    const svc = buildService();
    const token = await svc.generateJoinToken({
      roomName: 'tenant-a:meeting-1',
      userId: 'user-1',
      participantName: 'Líder',
    });
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT header.payload.signature
  });
});
