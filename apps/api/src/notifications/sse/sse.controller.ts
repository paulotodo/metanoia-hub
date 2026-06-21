import { Controller, Logger, Sse } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, interval, merge } from 'rxjs';
import { finalize, map } from 'rxjs/operators';
import { uuidv7 } from 'uuidv7';
import { getRequestContext } from '../../common/context/request-context';
import type { EnvConfig } from '../../config/env.validation';
import { SseConnectionManager } from './sse-connection.manager';
import { SseRedisService } from './sse-redis.service';

/**
 * SseController — SSE endpoint for real-time notification delivery.
 *
 * Endpoint: GET /api/v1/sse/notifications
 * Auth: Keycloak APP_GUARD (global) via Authorization: Bearer or ?token= fallback
 *       (keycloak.guard.ts L143-156 — no duplicate guard needed here).
 *
 * SR-1 (dec-017): this controller NEVER logs req.url, req.query.token,
 * Referer, or any field that might expose the JWT token. Structured logging only.
 */
@Controller('api/v1/sse')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  constructor(
    private readonly connectionManager: SseConnectionManager,
    private readonly sseRedisService: SseRedisService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  /**
   * GET /api/v1/sse/notifications
   *
   * Streams SSE events for the authenticated user:
   *  - `event: notification` with payload `{ id, type, title, body, createdAt }`
   *  - `event: heartbeat` (empty data) at SSE_HEARTBEAT_INTERVAL_MS interval
   *
   * Connection lifecycle:
   *  1. Registers connection in Redis ZSET (evicts oldest if per-user limit reached)
   *  2. Merges notification stream with heartbeat interval
   *  3. Releases connection on client disconnect (finalize operator)
   */
  @Sse('notifications')
  stream(): Observable<MessageEvent> {
    const { tenantId, userId } = getRequestContext();

    if (!userId) {
      throw new Error('userId not available in RequestContext for SSE connection');
    }

    const connectionId = uuidv7();
    const heartbeatMs = this.configService.get('SSE_HEARTBEAT_INTERVAL_MS', { infer: true });

    // Register connection asynchronously; if limit exceeded, exception propagates to client
    // We need to handle the async registration before returning the Observable
    // Using a wrapper Observable to allow async setup
    return new Observable<MessageEvent>((subscriber) => {
      let setupDone = false;

      const setup = async (): Promise<void> => {
        try {
          const { evicted } = await this.connectionManager.checkAndRegister(
            tenantId,
            userId,
            connectionId,
          );

          if (evicted) {
            // SC-04: send close event to evicted connection's channel
            // The evicted connection will receive this via its own Redis subscription
            // (the close is handled by the SseRedisService subscriber observing an internal channel,
            // or via a direct Subject — for MVP, we log the eviction; the old connection
            // will time out naturally as its heartbeat stops)
            this.logger.log(
              { tenantId, userId, evicted, connectionId },
              'sse: evicted oldest connection to accept new one (SC-04)',
            );
          }

          setupDone = true;

          // Heartbeat stream
          const heartbeat$ = interval(heartbeatMs).pipe(
            map(
              () =>
                ({
                  type: 'heartbeat',
                  data: '',
                }) as MessageEvent,
            ),
          );

          // Notification stream from Redis
          const notifications$ = this.sseRedisService.subscribe(tenantId, userId);

          // Merge both streams
          const combined$ = merge(notifications$, heartbeat$).pipe(
            finalize(() => {
              // SC-07, NFR-05: deterministic teardown on client disconnect
              void this.connectionManager.release(tenantId, userId, connectionId).then(() => {
                this.logger.debug(
                  { tenantId, userId, connectionId },
                  'sse: connection released on finalize',
                );
              });
            }),
          );

          const sub = combined$.subscribe({
            next: (evt) => subscriber.next(evt),
            error: (err: Error) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });

          subscriber.add(() => sub.unsubscribe());
        } catch (err) {
          subscriber.error(err);
        }
      };

      void setup();

      // Cleanup if subscriber unsubscribes before setup completes
      return () => {
        if (!setupDone) {
          this.logger.debug(
            { tenantId, userId, connectionId },
            'sse: subscriber unsubscribed before setup completed',
          );
        }
      };
    });
  }
}
