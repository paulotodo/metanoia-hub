/**
 * CheckEmailsRateLimitGuard — in-memory per-tenant rate limiter for GET /users/check-emails.
 *
 * Decision (API-08): 30 req/min/tenant — gives margin for ceil(N/500) batch calls
 * when the admin imports ~15 000-line CSVs (max 30 batches per minute).
 *
 * Pattern mirrors PrivacyRateLimitGuard / MarketingRateLimitGuard (project standard):
 * custom in-memory guard because @nestjs/throttler is not installed in this project.
 * If the API scales horizontally, swap for a Redis-backed implementation.
 *
 * Key: tenantId from AsyncLocalStorage (RequestContext) — never from HTTP input.
 * Falls back to IP when tenantId is unavailable (defensive, should not happen for
 * authenticated routes).
 */

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { getRequestContext } from '../common/context/request-context';

export interface Bucket {
  count: number;
  resetAt: number;
}

export const WINDOW_MS = 60_000;   // 1 minute
export const MAX_REQUESTS = 30;    // 30 req/min/tenant (API-08)
export const MAX_TRACKED_KEYS = 10_000;

@Injectable()
export class CheckEmailsRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(CheckEmailsRateLimitGuard.name);
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    // Prefer tenantId (scoped to tenant, more granular than IP for auth routes)
    let key: string;
    try {
      const { tenantId } = getRequestContext();
      key = `tenant:${tenantId}`;
    } catch {
      // Fallback to IP — should not happen on authenticated routes
      const req = context.switchToHttp().getRequest<{ ip?: string; socket: { remoteAddress?: string } }>();
      key = `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
    }

    const now = Date.now();
    this.evictExpired(now);

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 1, resetAt: now + WINDOW_MS };
      this.buckets.set(key, bucket);
      return true;
    }

    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      this.logger.warn(
        { key, count: bucket.count, retryAfterSec },
        'check-emails rate limit exceeded',
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message:
            'Muitas requisições em pouco tempo. Tente novamente em instantes.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private evictExpired(now: number): void {
    if (this.buckets.size <= MAX_TRACKED_KEYS) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Exposed for testing only — clears all buckets. */
  _clearBuckets(): void {
    this.buckets.clear();
  }
}
