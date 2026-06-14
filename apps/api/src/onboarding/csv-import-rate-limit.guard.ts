/**
 * CsvImportRateLimitGuard — in-memory per-tenant rate limiter for the
 * POST /api/v1/groups/:groupId/members/import endpoint.
 *
 * Decision (FASE 8 OWASP — Story 10-4): CSV import is a write-heavy
 * authenticated endpoint that can trigger large DB operations (up to 5000 rows)
 * and BullMQ jobs. Rate limiting prevents DoS via mass rapid submissions.
 *
 * Limit: 10 req/min/tenant. A single upload-confirm cycle uses 1 request;
 * 10/min gives headroom for retries and admin workflows without allowing abuse.
 *
 * Pattern mirrors CheckEmailsRateLimitGuard / PrivacyRateLimitGuard
 * (project standard): custom in-memory guard because @nestjs/throttler
 * is not installed in this project. If the API scales horizontally,
 * swap for a Redis-backed implementation.
 *
 * Key: tenantId from AsyncLocalStorage (RequestContext) — never from HTTP input.
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
export const MAX_REQUESTS = 10;    // 10 req/min/tenant
export const MAX_TRACKED_KEYS = 10_000;

@Injectable()
export class CsvImportRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(CsvImportRateLimitGuard.name);
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    let key: string;
    try {
      const { tenantId } = getRequestContext();
      key = `tenant:${tenantId}`;
    } catch {
      // Fallback to IP — should not happen on authenticated routes
      const req = context
        .switchToHttp()
        .getRequest<{ ip?: string; socket: { remoteAddress?: string } }>();
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
        'csv-import rate limit exceeded',
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
