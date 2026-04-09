import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { EnvConfig } from '../../config/env.validation';

interface SseEvent {
  tenantId: string;
  meetingId: string;
  data: string;
}

@Injectable()
export class MeetingSseService implements OnModuleDestroy {
  private readonly logger = new Logger(MeetingSseService.name);
  private readonly subscriber: Redis;
  private readonly eventSubject = new Subject<SseEvent>();
  private readonly channelSubscriberCount = new Map<string, number>();

  constructor(configService: ConfigService<EnvConfig, true>) {
    // Dedicated Redis connection for Pub/Sub (subscriber mode blocks the connection)
    this.subscriber = new Redis({
      host: configService.get('REDIS_HOST', { infer: true }),
      port: configService.get('REDIS_PORT', { infer: true }),
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      // Parse channel: rt:meeting:{tenantId}:{meetingId}:events
      const parts = channel.split(':');
      const tenantId = parts[2];
      const meetingId = parts[3];
      this.eventSubject.next({ tenantId, meetingId, data: message });
    });
  }

  subscribe(
    tenantId: string,
    meetingId: string,
  ): Observable<MessageEvent> {
    const channel = `rt:meeting:${tenantId}:${meetingId}:events`;

    // Track subscriber count per channel
    const currentCount = this.channelSubscriberCount.get(channel) ?? 0;
    if (currentCount === 0) {
      this.subscriber.subscribe(channel);
      this.logger.log({ tenantId, meetingId }, 'subscribed to sse channel');
    }
    this.channelSubscriberCount.set(channel, currentCount + 1);

    return new Observable<MessageEvent>((subscriber) => {
      const subscription = this.eventSubject
        .pipe(
          filter(
            (evt) =>
              evt.tenantId === tenantId && evt.meetingId === meetingId,
          ),
        )
        .subscribe({
          next: (evt) => {
            subscriber.next({
              data: evt.data,
            } as MessageEvent);
            this.logger.log(
              { tenantId, meetingId },
              'sse event pushed to client',
            );
          },
        });

      return () => {
        subscription.unsubscribe();
        // Unsubscribe from Redis channel when no more clients
        const count = (this.channelSubscriberCount.get(channel) ?? 1) - 1;
        if (count <= 0) {
          this.subscriber.unsubscribe(channel);
          this.channelSubscriberCount.delete(channel);
          this.logger.log({ tenantId, meetingId }, 'unsubscribed from sse channel (no clients)');
        } else {
          this.channelSubscriberCount.set(channel, count);
        }
        this.logger.log({ tenantId, meetingId }, 'sse client disconnected');
      };
    });
  }

  async onModuleDestroy() {
    this.eventSubject.complete();
    await this.subscriber.quit();
  }
}
