import { Injectable } from '@nestjs/common';
import type { NotificationChannelInterface } from './channels/notification-channel.interface';
import { InAppChannel } from './channels/in-app.channel';
import { EmailChannel } from './channels/email.channel';

/**
 * UnknownChannelError — thrown when ChannelRouter.route() receives a
 * channel name that has no registered implementation.
 */
export class UnknownChannelError extends Error {
  constructor(channel: string) {
    super(`Unknown notification channel: ${channel}`);
    this.name = 'UnknownChannelError';
  }
}

/**
 * ChannelRouter — maps channel names to their NotificationChannelInterface
 * implementations. Adding a new channel requires:
 *   1. New class implementing NotificationChannelInterface.
 *   2. Inject it here and register in the channelMap.
 *   3. Register in NotificationsModule providers.
 * ChannelRouter itself is not modified (Open/Closed Principle, FR-005).
 */
@Injectable()
export class ChannelRouter {
  private readonly channelMap: Map<string, NotificationChannelInterface>;

  constructor(
    private readonly inAppChannel: InAppChannel,
    private readonly emailChannel: EmailChannel,
  ) {
    this.channelMap = new Map<string, NotificationChannelInterface>([
      [inAppChannel.channel, inAppChannel],
      [emailChannel.channel, emailChannel],
    ]);
  }

  route(channel: string): NotificationChannelInterface {
    const impl = this.channelMap.get(channel);
    if (!impl) {
      throw new UnknownChannelError(channel);
    }
    return impl;
  }
}
