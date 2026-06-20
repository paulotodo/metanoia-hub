import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPayload, NotificationResult } from '@metanoia/types';
import type { NotificationChannelInterface } from './notification-channel.interface';

/**
 * EmailChannel — stub implementation for Story 14-1.
 * Real email delivery (Resend / SMTP) is scoped to Story 14.3.
 * Implements the same interface as InAppChannel so the ChannelRouter
 * and worker are not modified when the real provider is wired in.
 */
@Injectable()
export class EmailChannel implements NotificationChannelInterface {
  readonly channel = 'email' as const;
  private readonly logger = new Logger(EmailChannel.name);

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    // Stub: log and return success. Story 14.3 replaces this body.
    this.logger.log(
      { notificationId: payload.notificationId, userId: payload.userId },
      'email delivery delegated (stub OK)',
    );
    return { success: true };
  }
}
