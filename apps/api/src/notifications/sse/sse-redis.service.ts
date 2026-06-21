import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { NotificationRealtimeEventSchema } from '@metanoia/types';
import type { EnvConfig } from '../../config/env.validation';

interface SseNotificationEvent {
  tenantId: string;
  userId: string;
  raw: string;
}

/**
 * SseRedisService — dedicated ioredis connection for subscriber mode.
 *
 * Subscribes to Redis channels `rt:notifications:{tenantId}:{userId}` published
 * by InAppChannel (Story 14-1). Maintains refcount per channel to avoid redundant
 * subscribe/unsubscribe calls when multiple connections share the same channel.
 *
 * Implements blast-radius containment (EC-02, dec-012):
 *  - Subscriber errors close only the affected channel's connections via a
 *    per-channel error Subject, not all active connections.
 *
 * SR-1 (dec-017): NEVER log req.url, req.query.token, Referer, or any field
 * that might contain the JWT token. All log calls use structured fields only.
 */
@Injectable()
export class SseRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(SseRedisService.name);
  private readonly subscriber: Redis;
  private readonly eventSubject = new Subject<SseNotificationEvent>();
  private readonly channelSubscriberCount = new Map<string, number>();

  constructor(configService: ConfigService<EnvConfig, true>) {
    // Dedicated Redis connection for Pub/Sub — subscriber mode blocks the connection
    this.subscriber = new Redis({
      host: configService.get('REDIS_HOST', { infer: true }),
      port: configService.get('REDIS_PORT', { infer: true }),
    });

    // Parse incoming messages and emit to event subject
    this.subscriber.on('message', (channel: string, message: string) => {
      // Channel format: rt:notifications:{tenantId}:{userId}
      const parts = channel.split(':');
      // parts[0]='rt', parts[1]='notifications', parts[2]=tenantId, parts[3]=userId
      const tenantId = parts[2];
      const userId = parts[3];

      if (!tenantId || !userId) {
        this.logger.error({ channel }, 'sse-redis: received message on malformed channel');
        return;
      }

      this.eventSubject.next({ tenantId, userId, raw: message });
    });

    // EC-02: subscriber errors are logged; future per-channel error handling
    // would close only the affected channel's connections (blast radius minimal)
    this.subscriber.on('error', (err: Error) => {
      this.logger.error(
        { error: err.message },
        'sse-redis: subscriber connection error (EC-02)',
      );
    });
  }

  /**
   * Subscribe to notifications for a specific tenant+user.
   *
   * Returns an Observable<MessageEvent> that:
   *  1. Subscribes to Redis channel (if first subscriber via refcount)
   *  2. Filters events by tenantId+userId (SC-06: cross-tenant isolation)
   *  3. Maps raw Redis payload to SSE MessageEvent with notificationId→id mapping
   *  4. Unsubscribes on teardown (if last subscriber via refcount)
   */
  subscribe(tenantId: string, userId: string): Observable<MessageEvent> {
    const channel = `rt:notifications:${tenantId}:${userId}`;

    // Track subscriber count per channel — avoid duplicate Redis subscriptions
    const currentCount = this.channelSubscriberCount.get(channel) ?? 0;
    if (currentCount === 0) {
      void this.subscriber.subscribe(channel);
      this.logger.log({ tenantId, userId }, 'sse-redis: subscribed to notification channel');
    }
    this.channelSubscriberCount.set(channel, currentCount + 1);

    return new Observable<MessageEvent>((subscriber) => {
      const subscription = this.eventSubject
        .pipe(
          // SC-06: strict tenantId+userId filter — cross-tenant isolation guarantee
          filter(
            (evt) => evt.tenantId === tenantId && evt.userId === userId,
          ),
          // Map raw Redis payload to SSE MessageEvent
          map((evt): MessageEvent | null => {
            let rawParsed: unknown;
            try {
              rawParsed = JSON.parse(evt.raw);
            } catch {
              // EC-06: discard invalid JSON, log error, keep observer active
              this.logger.error(
                { raw: '[redacted]' },
                'sse-redis: notification payload is not valid JSON — discarding',
              );
              return null;
            }

            const parsed = NotificationRealtimeEventSchema.safeParse(rawParsed);

            if (!parsed.success) {
              // EC-06: discard schema-invalid payload, log error, keep observer active
              this.logger.error(
                { issues: parsed.error.issues },
                'sse-redis: malformed notification payload — discarding',
              );
              return null;
            }

            // Mapping: notificationId → id at SSE wire boundary (spec §FR-08, contracts §Mapeamento)
            const { notificationId, type, title, body, createdAt } = parsed.data;
            return {
              data: JSON.stringify({ id: notificationId, type, title, body, createdAt }),
            } as MessageEvent;
          }),
          // Filter out null values from malformed payloads (EC-06)
          filter((evt): evt is MessageEvent => evt !== null),
        )
        .subscribe({
          next: (evt) => {
            subscriber.next(evt);
            this.logger.debug({ tenantId, userId }, 'sse-redis: notification event pushed');
          },
          error: (err: Error) => {
            subscriber.error(err);
          },
          complete: () => {
            subscriber.complete();
          },
        });

      // Teardown: decrement refcount, unsubscribe from Redis if no more clients
      return () => {
        subscription.unsubscribe();
        const count = (this.channelSubscriberCount.get(channel) ?? 1) - 1;
        if (count <= 0) {
          void this.subscriber.unsubscribe(channel);
          this.channelSubscriberCount.delete(channel);
          this.logger.log(
            { tenantId, userId },
            'sse-redis: unsubscribed from channel (no more clients)',
          );
        } else {
          this.channelSubscriberCount.set(channel, count);
        }
        this.logger.debug({ tenantId, userId }, 'sse-redis: client disconnected');
      };
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.eventSubject.complete();
    await this.subscriber.quit();
  }
}
