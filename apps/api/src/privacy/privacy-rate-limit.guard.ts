/**
 * PrivacyRateLimitGuard — in-memory IP rate limiter for the public privacy endpoint.
 *
 * Decision (GAP-04, dec-016): @nestjs/throttler is not installed in this project.
 * The project pattern for public endpoints is a custom in-memory guard (see
 * MarketingRateLimitGuard). This guard applies the same pattern with a higher
 * limit (30 req/min vs 5 for marketing) because GET /privacy/data-processing is
 * a read-only, cacheable endpoint expected to serve more traffic.
 *
 * If the API scales horizontally, swap for a Redis-backed implementation.
 * Redis is already wired into this app.
 */
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

const WINDOW_MS = 60_000;    // 1 minute
const MAX_REQUESTS = 30;      // 30 req/min (read-only, higher than marketing write forms)
const MAX_TRACKED_IPS = 10_000;

@Injectable()
export class PrivacyRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(PrivacyRateLimitGuard.name);
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
        'privacy rate limit exceeded',
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
    if (this.buckets.size <= MAX_TRACKED_IPS) return;
    for (const [ip, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(ip);
    }
  }
}
