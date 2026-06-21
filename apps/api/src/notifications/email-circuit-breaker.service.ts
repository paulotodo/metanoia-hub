/**
 * EmailCircuitBreakerService — Redis-backed circuit breaker for the email channel.
 *
 * Circuit state lives in a Redis hash: `rate:email:circuit:{tenantId}`
 * Fields: state (open|closed), firstFailureAt (ms timestamp), consecutiveHealthy (count), openedAt (ms)
 *
 * OPENING LOGIC (L3 / spec.md §FR-13):
 *   Opens when: Date.now() - firstFailureAt > 5 minutes (300000ms)
 *   Does NOT require isHealthy() == false to open (independence from 14-4 stub).
 *   Emits domain event: notifications.email.circuit-open.
 *
 * RECOVERY LOGIC (spec.md §FR-14):
 *   Checks EmailHealthPort.isHealthy() every call when state=open.
 *   3 consecutive healthy checks → closes (state=closed, reset counters).
 *   Deferred notifications during outage are NOT retried (FR-15).
 *
 * SECURITY:
 *   L1/CHK029: no PII or email content in logs.
 *   L2: tenantId only in Redis key, not logged.
 *
 * INTEGRATION POINT (Story 14-4): inject real EmailHealthPort impl to replace stub.
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { EMAIL_HEALTH_PORT, type EmailHealthPort } from './ports/email-health.port';
import { uuidv7 } from 'uuidv7';

const OPEN_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes — SC-03 / spec.md §FR-13
const HEALTHY_CHECKS_TO_CLOSE = 3;        // spec.md §FR-14
const CIRCUIT_HASH_TTL_SECONDS = 86400;   // 24h auto-expiry

type CircuitState = 'closed' | 'open';

interface CircuitBreakerState {
  state: CircuitState;
  firstFailureAt: number | null;
  consecutiveHealthy: number;
  openedAt: number | null;
}

function circuitKey(tenantId: string): string {
  return `rate:email:circuit:${tenantId}`;
}

@Injectable()
export class EmailCircuitBreakerService {
  private readonly logger = new Logger(EmailCircuitBreakerService.name);

  constructor(
    private readonly redis: RedisService,
    @Inject(EMAIL_HEALTH_PORT) private readonly healthPort: EmailHealthPort,
  ) {}

  // ── Internal state helpers ────────────────────────────────────────────────

  private async getState(tenantId: string): Promise<CircuitBreakerState> {
    try {
      const raw = await (this.redis as unknown as {
        hgetall(key: string): Promise<Record<string, string> | null>
      }).hgetall(circuitKey(tenantId));
      if (!raw || !raw.state) {
        return { state: 'closed', firstFailureAt: null, consecutiveHealthy: 0, openedAt: null };
      }
      return {
        state: raw.state as CircuitState,
        firstFailureAt: raw.firstFailureAt ? Number(raw.firstFailureAt) : null,
        consecutiveHealthy: Number(raw.consecutiveHealthy ?? 0),
        openedAt: raw.openedAt ? Number(raw.openedAt) : null,
      };
    } catch {
      // Redis unavailable: default to closed (fail-open for circuit reads)
      return { state: 'closed', firstFailureAt: null, consecutiveHealthy: 0, openedAt: null };
    }
  }

  private async setState(tenantId: string, state: CircuitBreakerState): Promise<void> {
    const key = circuitKey(tenantId);
    const fields: string[] = [
      'state', state.state,
      'consecutiveHealthy', String(state.consecutiveHealthy),
    ];
    if (state.firstFailureAt !== null) fields.push('firstFailureAt', String(state.firstFailureAt));
    if (state.openedAt !== null) fields.push('openedAt', String(state.openedAt));

    try {
      await (this.redis as unknown as {
        hset(key: string, ...args: string[]): Promise<number>
      }).hset(key, ...fields);
      await (this.redis as unknown as {
        expire(key: string, ttl: number): Promise<number>
      }).expire(key, CIRCUIT_HASH_TTL_SECONDS);
    } catch (err) {
      this.logger.error({ error: (err as Error).message }, 'circuit breaker: Redis write failed');
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * isOpen — returns true if the circuit is open (email delivery skipped).
   * When open: caller should create immediate in-app fallback.
   * Also triggers health check recovery logic when already open.
   */
  async isOpen(tenantId: string): Promise<boolean> {
    const cbState = await this.getState(tenantId);

    if (cbState.state === 'closed') return false;

    // Circuit is open: check if we can recover
    await this.attemptRecovery(tenantId, cbState);

    // Re-read state after recovery attempt
    const refreshed = await this.getState(tenantId);
    return refreshed.state === 'open';
  }

  /**
   * onSendSuccess — called after a successful email delivery.
   * Resets firstFailureAt when closed (prevents stale timer accumulation).
   */
  async onSendSuccess(tenantId: string): Promise<void> {
    const cbState = await this.getState(tenantId);
    if (cbState.state === 'closed' && cbState.firstFailureAt !== null) {
      await this.setState(tenantId, {
        ...cbState,
        firstFailureAt: null,
        consecutiveHealthy: 0,
      });
    }
  }

  /**
   * onSendFailure — called after a transient email delivery failure.
   * Sets firstFailureAt on first failure; opens circuit after 5min.
   *
   * L3 / spec.md §FR-13: opening is time-based, not isHealthy()-based.
   * This ensures circuit opens even if 14-4 stub always returns true.
   */
  async onSendFailure(tenantId: string, correlationId?: string): Promise<void> {
    const cbState = await this.getState(tenantId);
    const now = Date.now();

    if (cbState.state === 'open') return; // Already open

    const firstFailureAt = cbState.firstFailureAt ?? now;

    if (now - firstFailureAt > OPEN_THRESHOLD_MS) {
      // Open the circuit
      const openedAt = now;
      await this.setState(tenantId, {
        state: 'open',
        firstFailureAt,
        consecutiveHealthy: 0,
        openedAt,
      });

      this.logger.warn({ openedAt }, 'email:circuit_open — fallbacks active');

      // Emit domain event (spec.md §FR-12/5.3.6)
      await this.emitCircuitOpenEvent(tenantId, openedAt, correlationId);
    } else {
      // Not yet past threshold — update firstFailureAt
      await this.setState(tenantId, {
        ...cbState,
        firstFailureAt,
        consecutiveHealthy: 0,
      });
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async attemptRecovery(tenantId: string, cbState: CircuitBreakerState): Promise<void> {
    try {
      const healthy = await this.healthPort.isHealthy();
      if (!healthy) {
        // Reset consecutive counter
        await this.setState(tenantId, { ...cbState, consecutiveHealthy: 0 });
        return;
      }

      const newConsecutive = cbState.consecutiveHealthy + 1;
      if (newConsecutive >= HEALTHY_CHECKS_TO_CLOSE) {
        // Close circuit (FR-14: 3 consecutive healthy checks)
        await this.setState(tenantId, {
          state: 'closed',
          firstFailureAt: null,
          consecutiveHealthy: 0,
          openedAt: null,
        });
        this.logger.log({}, 'email:circuit_closed — email delivery resumed');
      } else {
        await this.setState(tenantId, { ...cbState, consecutiveHealthy: newConsecutive });
      }
    } catch {
      // health check threw: no-op (don't close circuit)
    }
  }

  /**
   * emitCircuitOpenEvent — publish domain event via Redis pub/sub.
   * Format: data-model.md §Domain Event canonical schema.
   * Channel: `rt:notifications:circuit-open:{tenantId}` (internal).
   * L1: no PII or email content in event.
   */
  private async emitCircuitOpenEvent(
    tenantId: string,
    openedAt: number,
    correlationId?: string,
  ): Promise<void> {
    const event = {
      eventId: uuidv7(),
      eventType: 'notifications.email.circuit-open',
      version: 1,
      tenantId,
      timestamp: new Date(openedAt).toISOString(),
      data: { openedAt: new Date(openedAt).toISOString(), reason: 'failure_duration_exceeded_5min' },
      metadata: { correlationId: correlationId ?? uuidv7() },
    };

    try {
      const channel = `rt:notifications:circuit-open:${tenantId}`;
      await (this.redis as unknown as {
        publish(channel: string, message: string): Promise<number>
      }).publish(channel, JSON.stringify(event));
    } catch (err) {
      this.logger.error(
        { error: (err as Error).message },
        'circuit breaker: failed to publish circuit-open event',
      );
    }
  }
}
