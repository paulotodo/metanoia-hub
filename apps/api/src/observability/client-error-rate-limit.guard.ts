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

/**
 * In-memory IP rate limiter for the public client-error reporting endpoint.
 * Higher cap than marketing forms (30/min vs. 5/min) — error storms are
 * normal during incidents and we don't want to throttle our own telemetry.
 *
 * Single-process; swap for a Redis-backed implementation if we ever scale
 * the API horizontally.
 */
@Injectable()
export class ClientErrorRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(ClientErrorRateLimitGuard.name);
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    this.evictExpired(now);

    let bucket = this.buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 1, resetAt: now + WINDOW_MS };
      this.buckets.set(ip, bucket);
      return true;
    }

    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      this.logger.warn(
        { ip, count: bucket.count, retryAfterSec },
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

  private evictExpired(now: number): void {
    if (this.buckets.size <= MAX_TRACKED_IPS) return;
    for (const [ip, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(ip);
    }
  }
}
