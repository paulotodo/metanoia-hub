import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { withTenantTx } from '../../prisma/with-tenant-tx';
import { requestContext } from '../context/request-context';

const DEBOUNCE_KEY_TTL = 900; // 15 min in seconds
const DEBOUNCE_KEY_PREFIX = 'rt:lastseen:';

/**
 * LastSeenInterceptor — records `users.last_seen_at` for every authenticated request.
 *
 * Design constraints (Story 13.3 / FR66-C1):
 *  - Fire-and-forget: the update runs AFTER the response is sent (tap).
 *  - Fail-open: Redis or DB errors are swallowed — never block the request.
 *  - Debounce: Redis SET NX EX 900 prevents DB writes more than once per 15 min per user.
 *  - No tenant_id as function param: resolved from RequestContext (AsyncLocalStorage).
 *
 * NOTE: RedisService extends ioredis Redis directly — methods are called on the
 * injected service itself (no getClient() wrapper).
 */
@Injectable()
export class LastSeenInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LastSeenInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        // Fire-and-forget — intentionally not awaited
        void this.recordLastSeen();
      }),
    );
  }

  private async recordLastSeen(): Promise<void> {
    try {
      const ctx = requestContext.getStore();
      if (!ctx?.userId || !ctx?.tenantId) return;

      const { userId, tenantId } = ctx;

      // Debounce: skip if already written within the last 15 min
      const key = `${DEBOUNCE_KEY_PREFIX}${tenantId}:${userId}`;
      // RedisService extends ioredis Redis — call set() directly on the service
      const acquired = await this.redis.set(key, '1', 'EX', DEBOUNCE_KEY_TTL, 'NX');
      if (!acquired) return; // already written recently

      // Update last_seen_at within tenant RLS context
      await withTenantTx(
        this.prisma,
        (tx) =>
          tx.$executeRawUnsafe(
            `UPDATE users SET last_seen_at = now() WHERE id = $1::uuid`,
            userId,
          ),
        { tenantId },
      );
    } catch (err) {
      // Fail-open: log but never propagate
      this.logger.warn(
        { error: (err as Error).message },
        'last_seen_update_failed (fail-open)',
      );
    }
  }
}
