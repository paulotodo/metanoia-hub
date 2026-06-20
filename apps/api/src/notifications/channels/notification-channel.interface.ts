import type { NotificationPayload, NotificationResult } from '@metanoia/types';

/**
 * NotificationChannelInterface — contract every delivery channel must implement.
 * Adding a new channel = implement this interface + register in NotificationsModule.
 * ChannelRouter is not modified (Open/Closed Principle, FR-005).
 */
export interface NotificationChannelInterface {
  /** The channel name as stored in the DB enum `notification_channel`. */
  readonly channel: 'in_app' | 'email';

  /**
   * Deliver the notification via this channel.
   * Implementations MUST NOT throw — return { success: false, error } instead.
   * The worker re-throws on false to trigger BullMQ retry.
   */
  send(payload: NotificationPayload): Promise<NotificationResult>;
}
