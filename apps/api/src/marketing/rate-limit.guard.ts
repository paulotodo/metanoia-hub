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
const MAX_REQUESTS = 5;
const MAX_TRACKED_IPS = 10_000;

// Simple in-memory IP rate limiter for public marketing endpoints.
// Single-process; if we ever scale horizontally, swap for a Redis-backed
// implementation (Redis is already wired into this app).
@Injectable()
export class MarketingRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(MarketingRateLimitGuard.name);
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
        'marketing rate limit exceeded',
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message:
            'Você enviou muitas requisições recentes. Tente novamente em alguns instantes.',
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
