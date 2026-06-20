import { describe, it, expect } from 'vitest';
import { EmailChannel } from './email.channel';

describe('EmailChannel', () => {
  it('returns success: true (stub)', async () => {
    const channel = new EmailChannel();
    const result = await channel.send({
      notificationId: '019756c0-0002-7000-8000-000000000001',
      tenantId: '019756c0-0002-7000-8000-000000000002',
      userId: '019756c0-0002-7000-8000-000000000003',
      channel: 'email',
      type: 'group_message',
      title: 'Test',
      body: 'Test body',
    });
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('does not throw exceptions', async () => {
    const channel = new EmailChannel();
    await expect(
      channel.send({
        notificationId: '019756c0-0002-7000-8000-000000000001',
        tenantId: '019756c0-0002-7000-8000-000000000002',
        userId: '019756c0-0002-7000-8000-000000000003',
        channel: 'email',
        type: 'pastoral_alert',
        title: 'Alerta pastoral',
        body: 'Membro em risco',
      }),
    ).resolves.toEqual({ success: true });
  });

  it('has channel property = email', () => {
    const channel = new EmailChannel();
    expect(channel.channel).toBe('email');
  });
});
