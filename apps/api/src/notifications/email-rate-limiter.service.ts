import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RedisService } from '../redis/redis.service';
import { CRITICAL_NOTIFICATION_TYPES } from '@metanoia/types';

export type RateLimitDecision = 'allow' | 'allow_critical' | 'defer';

export interface RateLimitResult {
  /** What to do with the notification. */
  decision: RateLimitDecision;
  /** Current daily counter after this call. */
  count: number;
  /**
   * True on the FIRST crossing of EMAIL_RATE_THRESHOLD in the current UTC day.
   * Triggers an in-app admin alert (spec.md §P5/FR-10).
   * Guaranteed to fire exactly once per tenant per day (atomic SET NX in Lua).
   */
  crossedThreshold: boolean;
  /**
   * For meeting_reminder deferral: caller should create an immediate in-app fallback.
   * For other non-critical deferral: caller sets metadata.deferredUntil.
   */
  shouldFallbackInApp: boolean;
}

/** Daily counter Redis key namespace (tenant-scoped, NOT logged per L2). */
function rateKey(tenantId: string, dateStr: string): string {
  return `rate:email:${tenantId}:${dateStr}`;
}

function alertedKey(tenantId: string, dateStr: string): string {
  return `rate:email:${tenantId}:${dateStr}:alerted`;
}

/** Compute seconds remaining until midnight UTC (minimum 1 second). */
function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

/** YYYYMMDD string for the current UTC date. */
function utcDateStr(): string {
  const now = new Date();
  return (
    now.getUTCFullYear().toString() +
    (now.getUTCMonth() + 1).toString().padStart(2, '0') +
    now.getUTCDate().toString().padStart(2, '0')
  );
}

@Injectable()
export class EmailRateLimiterService implements OnModuleInit {
  private readonly logger = new Logger(EmailRateLimiterService.name);
  private readonly dailyLimit: number;
  private readonly rateThreshold: number;
  private luaScript!: string;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.dailyLimit = this.configService.get<number>('EMAIL_DAILY_LIMIT', 100);
    this.rateThreshold = this.configService.get<number>('EMAIL_RATE_THRESHOLD', 80);
  }

  onModuleInit(): void {
    // Load Lua script at startup (compile once, reuse via ioredis EVALSHA caching)
    const luaPath = path.join(__dirname, 'scripts', 'rate-limit.lua');
    this.luaScript = fs.readFileSync(luaPath, 'utf8');
    this.logger.log(
      { dailyLimit: this.dailyLimit, rateThreshold: this.rateThreshold },
      'email rate limiter initialized',
    );
  }

  /**
   * Check whether an email notification should be sent, deferred, or bypassed.
   *
   * SECURITY (L2/CHK029): tenantId used only in Redis key — NEVER logged.
   * Atomicity: Lua script runs server-side; INCR + TTL + SET NX are atomic.
   *
   * @param tenantId - Tenant identifier (sourced from RequestContext, NOT logged)
   * @param type - Notification type (determines if critical/bypass logic applies)
   * @param channel - Notification channel (used to determine meeting_reminder fallback)
   * @returns RateLimitResult with decision and metadata
   */
  async check(
    tenantId: string,
    type: string,
    channel = 'email',
  ): Promise<RateLimitResult> {
    const isCritical = (CRITICAL_NOTIFICATION_TYPES as readonly string[]).includes(type);
    const date = utcDateStr();
    const key = rateKey(tenantId, date);
    const alertKey = alertedKey(tenantId, date);
    const ttl = secondsUntilMidnightUtc();

    try {
      // Execute Lua script atomically via ioredis eval
      const result = await (this.redis as unknown as {
        eval(script: string, numkeys: number, ...args: string[]): Promise<[string, string, string]>;
      }).eval(
        this.luaScript,
        1, // numkeys
        key,
        String(this.dailyLimit),
        String(this.rateThreshold),
        String(ttl),
        isCritical ? '1' : '0',
        alertKey,
      ) as [string, string, string];

      const [decision, countStr, crossedStr] = result;
      const count = Number(countStr);
      const crossedThreshold = crossedStr === '1';
      const isDeferred = decision === 'defer';

      // meeting_reminder deferred → immediate fallback in-app (participant NEVER loses reminder)
      const shouldFallbackInApp = isDeferred && type === 'meeting_reminder' && channel === 'email';

      this.logger.log(
        { type, decision, count, crossedThreshold },
        // L2: do NOT log tenantId here (only used for Redis key)
        'email:rate_limited',
      );

      if (crossedThreshold) {
        this.logger.warn(
          { count, limit: this.dailyLimit, threshold: this.rateThreshold },
          'email:rate_threshold_crossed — admin alert will be dispatched',
        );
      }

      return {
        decision: decision as RateLimitDecision,
        count,
        crossedThreshold,
        shouldFallbackInApp,
      };
    } catch (error) {
      // Redis failure: fail-open (allow send) to not block critical notifications
      const message = (error as Error).message;
      this.logger.error({ error: message }, 'email rate limiter error — failing open');
      return {
        decision: 'allow',
        count: 0,
        crossedThreshold: false,
        shouldFallbackInApp: false,
      };
    }
  }
}
