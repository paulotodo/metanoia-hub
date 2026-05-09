import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const MAX_TRACKED_IPS = 10_000;
const EVICT_BATCH = 256;

/**
 * In-memory IP rate limiter for the public client-error reporting endpoint.
 * Higher cap than marketing forms (30/min vs. 5/min) — error storms are
 * normal during incidents and we don't want to throttle our own telemetry.
 *
 * Single-process; swap for a Redis-backed implementation if we ever scale
 * the API horizontally. Trusts `req.ip` to reflect the real client IP, which
 * requires `app.set('trust proxy', ...)` in bootstrap.
 */
@Injectable()
export class ClientErrorRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(ClientErrorRateLimitGuard.name);
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = this.resolveKey(req);
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.evict(now);
      bucket = { count: 1, resetAt: now + WINDOW_MS };
      this.buckets.set(key, bucket);
      return true;
    }

    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      this.logger.warn(
        { key, count: bucket.count, retryAfterSec },
        'client-error rate limit exceeded',
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'TooManyRequests',
          message: 'Too many error reports. Try again shortly.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private resolveKey(req: Request): string {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }

  /**
   * Evict expired buckets on every fresh window, plus a hard-cap fallback
   * in case unique IPs accumulate faster than they expire (CGNAT, mobile
   * rotations, Tor). Bounded work per call to keep the path O(EVICT_BATCH).
   */
  private evict(now: number): void {
    let scanned = 0;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
      if (++scanned >= EVICT_BATCH) break;
    }

    if (this.buckets.size > MAX_TRACKED_IPS) {
      const overflow = this.buckets.size - MAX_TRACKED_IPS;
      let removed = 0;
      for (const key of this.buckets.keys()) {
        if (removed >= overflow) break;
        this.buckets.delete(key);
        removed += 1;
      }
    }
  }
}
