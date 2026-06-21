import {
  Injectable,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.validation';
import { RedisService } from '../../redis/redis.service';

/**
 * SseConnectionManager — tracks active SSE connections with Redis ZSET.
 *
 * Two-layer limit enforcement:
 *  - Per-instance: in-memory counter (instanceCount) checked before Redis ops.
 *  - Per-user: Redis ZSET `sse:connections:{tenantId}:{userId}` with score=timestamp.
 *
 * When per-user limit is reached, the oldest connection (lowest score) is evicted.
 *
 * CHK033 (tech debt MVP): race condition in multi-instance ZSET — two pods may
 * simultaneously read ZCARD=4, both accept, resulting in 6 connections for a
 * user with SSE_MAX_PER_USER=5. Mitigation requires Lua scripting or Redis locks.
 * Tracked as follow-up before Epic 14 close.
 */
@Injectable()
export class SseConnectionManager implements OnModuleInit {
  private readonly logger = new Logger(SseConnectionManager.name);
  private instanceCount = 0;
  private maxConnections!: number;
  private maxPerUser!: number;

  constructor(
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    const rawMax = this.configService.get('SSE_MAX_CONNECTIONS', { infer: true });
    const rawPerUser = this.configService.get('SSE_MAX_PER_USER', { infer: true });

    // EC-07: fallback to defaults with warning if value is somehow <= 0 after Zod transform
    this.maxConnections = rawMax > 0 ? rawMax : 1000;
    if (rawMax <= 0) {
      this.logger.warn(
        { value: rawMax },
        'SSE_MAX_CONNECTIONS is invalid (<=0); applying default 1000',
      );
    }

    this.maxPerUser = rawPerUser > 0 ? rawPerUser : 5;
    if (rawPerUser <= 0) {
      this.logger.warn(
        { value: rawPerUser },
        'SSE_MAX_PER_USER is invalid (<=0); applying default 5',
      );
    }

    this.logger.log(
      { maxConnections: this.maxConnections, maxPerUser: this.maxPerUser },
      'SseConnectionManager initialized',
    );
  }

  /**
   * Validates that a value is a valid UUID (v4 or v7 format).
   * Throws InternalServerErrorException if invalid (CHK022, dec-021/SR-5).
   */
  assertValidUuid(value: string, field: string): void {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(value)) {
      throw new InternalServerErrorException(
        `Invalid UUID format for field '${field}': ${value}`,
      );
    }
  }

  /**
   * Builds the Redis ZSET key for a user's SSE connections.
   * Asserts valid UUIDs before construction.
   */
  buildZsetKey(tenantId: string, userId: string): string {
    this.assertValidUuid(tenantId, 'tenantId');
    this.assertValidUuid(userId, 'userId');
    return `sse:connections:${tenantId}:${userId}`;
  }

  /**
   * Registers a connection in the ZSET (ZADD key timestamp connectionId).
   */
  async register(
    tenantId: string,
    userId: string,
    connectionId: string,
    timestamp: number,
  ): Promise<void> {
    const key = this.buildZsetKey(tenantId, userId);
    await this.redis.zadd(key, timestamp, connectionId);
  }

  /**
   * Removes a connection from the ZSET (ZREM key connectionId).
   * Returns silently if connectionId does not exist (EC-04).
   */
  async remove(tenantId: string, userId: string, connectionId: string): Promise<void> {
    const key = this.buildZsetKey(tenantId, userId);
    const removed = await this.redis.zrem(key, connectionId);
    if (removed === 0) {
      this.logger.debug(
        { tenantId, userId, connectionId },
        'ZREM returned 0 — connection already removed (EC-04, silent)',
      );
    }
  }

  /**
   * Returns the total number of active connections for a user (ZCARD).
   */
  async countConnections(tenantId: string, userId: string): Promise<number> {
    const key = this.buildZsetKey(tenantId, userId);
    return this.redis.zcard(key);
  }

  /**
   * Returns the connectionId of the oldest connection (lowest timestamp score),
   * or null if no connections exist (ZRANGE key 0 0).
   */
  async getOldestConnection(tenantId: string, userId: string): Promise<string | null> {
    const key = this.buildZsetKey(tenantId, userId);
    const result = await this.redis.zrange(key, 0, 0);
    return result[0] ?? null;
  }

  /**
   * Checks instance-level limit. Throws 503 with Retry-After: 30 if exceeded.
   */
  checkInstanceLimit(): void {
    if (this.instanceCount >= this.maxConnections) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message: 'Maximum SSE connections reached for this instance',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
        {
          cause: new Error('SSE_MAX_CONNECTIONS exceeded'),
          description: 'Retry-After: 30',
        },
      );
    }
  }

  /**
   * Atomic check-and-register: enforces both instance and per-user limits,
   * evicting the oldest connection if per-user limit is reached.
   *
   * Returns { evicted: connectionId | null } where evicted is the connectionId
   * that was removed to make room (caller must send close event to it).
   *
   * CHK033: race condition not mitigated in MVP — see class-level comment.
   */
  async checkAndRegister(
    tenantId: string,
    userId: string,
    connectionId: string,
  ): Promise<{ evicted: string | null }> {
    // Step 1: check instance limit before Redis ops
    this.checkInstanceLimit();

    const key = this.buildZsetKey(tenantId, userId);
    let evicted: string | null = null;

    // Step 2: check per-user limit; evict oldest if needed (EC-04: loop until ZREM succeeds)
    let currentCount = await this.redis.zcard(key);
    while (currentCount >= this.maxPerUser) {
      const oldest = await this.redis.zrange(key, 0, 0);
      if (!oldest[0]) break;

      const zremResult = await this.redis.zrem(key, oldest[0]);
      if (zremResult > 0) {
        // Successfully evicted
        evicted = oldest[0];
        this.logger.log(
          { tenantId, userId, evicted },
          'evicted oldest SSE connection (SC-04)',
        );
        break;
      }
      // ZREM returned 0 — connection was already removed by another caller; re-check count
      currentCount = await this.redis.zcard(key);
    }

    // Step 3: register new connection
    await this.redis.zadd(key, Date.now(), connectionId);
    this.instanceCount++;

    return { evicted };
  }

  /**
   * Releases a connection: removes from ZSET and decrements instance counter.
   * Deterministic teardown (SC-07, NFR-05).
   */
  async release(tenantId: string, userId: string, connectionId: string): Promise<void> {
    await this.remove(tenantId, userId, connectionId);
    this.instanceCount = Math.max(0, this.instanceCount - 1);
    this.logger.debug(
      { tenantId, userId, connectionId, instanceCount: this.instanceCount },
      'SSE connection released',
    );
  }
}
