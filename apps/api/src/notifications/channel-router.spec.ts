import { describe, it, expect, vi } from 'vitest';
import { ChannelRouter, UnknownChannelError } from './channel-router';
import { InAppChannel } from './channels/in-app.channel';
import { EmailChannel } from './channels/email.channel';

describe('ChannelRouter', () => {
  function makeChannels() {
    const inApp = { channel: 'in_app', send: vi.fn() } as unknown as InAppChannel;
    const email = { channel: 'email', send: vi.fn() } as unknown as EmailChannel;
    return { inApp, email };
  }

  it('routes in_app to InAppChannel', () => {
    const { inApp, email } = makeChannels();
    const router = new ChannelRouter(inApp, email);
    expect(router.route('in_app')).toBe(inApp);
  });

  it('routes email to EmailChannel', () => {
    const { inApp, email } = makeChannels();
    const router = new ChannelRouter(inApp, email);
    expect(router.route('email')).toBe(email);
  });

  it('throws UnknownChannelError for unknown channel', () => {
    const { inApp, email } = makeChannels();
    const router = new ChannelRouter(inApp, email);
    expect(() => router.route('sms')).toThrow(UnknownChannelError);
    expect(() => router.route('sms')).toThrow('Unknown notification channel: sms');
  });

  it('throws UnknownChannelError for empty string', () => {
    const { inApp, email } = makeChannels();
    const router = new ChannelRouter(inApp, email);
    expect(() => router.route('')).toThrow(UnknownChannelError);
  });
});
