/**
 * Unit tests for PastoralRiskEventPublisher (Story 13.3 / FR66 / FASE 8).
 *
 * Covers:
 *  - risk-detected dedup (same participant/group/day suppressed)
 *  - new day allows re-emission
 *  - risk-resolved emits correctly with resolvedBy context
 *  - schema validation failure = skip publish, no throw
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PastoralRiskEventPublisher } from './pastoral-risk-event-publisher.service';
import type { RedisService } from '../redis/redis.service';

const TENANT_ID = '01912345-6789-7000-8000-000000000001';
const PARTICIPANT_ID = '01912345-6789-7000-8000-0000000000a1';
const GROUP_ID = '01912345-6789-7000-8000-0000000000b1';
const JOB_RUN_ID = '01912345-6789-7000-8000-0000000000c1';

function makePublisher() {
  const redis = {
    exists: vi.fn().mockResolvedValue(0),
    set: vi.fn().mockResolvedValue('OK'),
    publish: vi.fn().mockResolvedValue(1),
  } as unknown as RedisService;

  const publisher = new PastoralRiskEventPublisher(redis);
  return { publisher, redis };
}

describe('PastoralRiskEventPublisher', () => {
  let ctx: ReturnType<typeof makePublisher>;

  beforeEach(() => {
    ctx = makePublisher();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-19T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('publishRiskDetected', () => {
    it('publishes event and sets dedup key on first call', async () => {
      await ctx.publisher.publishRiskDetected(
        PARTICIPANT_ID, GROUP_ID, TENANT_ID, 'absences', 'amarelo', JOB_RUN_ID,
      );

      expect(ctx.redis.publish).toHaveBeenCalledOnce();
      const [channel, payload] = (ctx.redis.publish as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
      expect(channel).toBe(`rt:pastoral-risk:${TENANT_ID}`);
      const event = JSON.parse(payload) as Record<string, unknown>;
      expect(event.eventType).toBe('pastoral.participant.risk-detected');
      expect(event.tenantId).toBe(TENANT_ID);
      expect((event.data as Record<string, unknown>).participantId).toBe(PARTICIPANT_ID);
      expect((event.data as Record<string, unknown>).riskReason).toBe('absences');
      expect((event.data as Record<string, unknown>).status).toBe('amarelo');

      // Dedup key must be set
      expect(ctx.redis.set).toHaveBeenCalledWith(
        `rt:risk-detected:${TENANT_ID}:${PARTICIPANT_ID}:${GROUP_ID}:2026-06-19`,
        '1',
        'EX',
        86400,
      );
    });

    it('suppresses duplicate event on same day (dedup)', async () => {
      (ctx.redis.exists as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await ctx.publisher.publishRiskDetected(
        PARTICIPANT_ID, GROUP_ID, TENANT_ID, 'absences', 'amarelo',
      );

      expect(ctx.redis.publish).not.toHaveBeenCalled();
      expect(ctx.redis.set).not.toHaveBeenCalled();
    });

    it('allows re-emission on new day (no existing dedup key)', async () => {
      // Day 1 — key exists
      (ctx.redis.exists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
      await ctx.publisher.publishRiskDetected(
        PARTICIPANT_ID, GROUP_ID, TENANT_ID, 'absences', 'amarelo',
      );
      expect(ctx.redis.publish).not.toHaveBeenCalled();

      // Advance to next day
      vi.setSystemTime(new Date('2026-06-20T10:00:00.000Z'));
      (ctx.redis.exists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0);

      await ctx.publisher.publishRiskDetected(
        PARTICIPANT_ID, GROUP_ID, TENANT_ID, 'absences', 'amarelo',
      );
      expect(ctx.redis.publish).toHaveBeenCalledOnce();
    });

    it('skips publish and does not throw on schema validation failure', async () => {
      // Pass an invalid riskReason to trigger schema failure
      await expect(
        ctx.publisher.publishRiskDetected(
          PARTICIPANT_ID, GROUP_ID, TENANT_ID,
          'invalid-reason' as never, 'amarelo',
        ),
      ).resolves.not.toThrow();
      expect(ctx.redis.publish).not.toHaveBeenCalled();
    });

    it('envelope has no PII fields (only IDs)', async () => {
      await ctx.publisher.publishRiskDetected(
        PARTICIPANT_ID, GROUP_ID, TENANT_ID, 'inactivity', 'vermelho', JOB_RUN_ID,
      );

      const [, payload] = (ctx.redis.publish as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
      const event = JSON.parse(payload) as Record<string, unknown>;
      const data = event.data as Record<string, unknown>;
      expect(data).not.toHaveProperty('name');
      expect(data).not.toHaveProperty('email');
      expect(data).not.toHaveProperty('phone');
    });
  });

  describe('publishRiskResolved', () => {
    it('publishes risk-resolved with attendance-based resolution', async () => {
      await ctx.publisher.publishRiskResolved(
        PARTICIPANT_ID, GROUP_ID, TENANT_ID, 'amarelo', JOB_RUN_ID,
      );

      expect(ctx.redis.publish).toHaveBeenCalledOnce();
      const [channel, payload] = (ctx.redis.publish as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
      expect(channel).toBe(`rt:pastoral-risk:${TENANT_ID}`);
      const event = JSON.parse(payload) as Record<string, unknown>;
      expect(event.eventType).toBe('pastoral.participant.risk-resolved');
      expect((event.data as Record<string, unknown>).previousStatus).toBe('amarelo');
    });

    it('publishes risk-resolved with vermelho previousStatus', async () => {
      await ctx.publisher.publishRiskResolved(
        PARTICIPANT_ID, GROUP_ID, TENANT_ID, 'vermelho',
      );

      const [, payload] = (ctx.redis.publish as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
      const event = JSON.parse(payload) as Record<string, unknown>;
      expect((event.data as Record<string, unknown>).previousStatus).toBe('vermelho');
    });

    it('does not set a dedup key (resolved can be re-emitted)', async () => {
      await ctx.publisher.publishRiskResolved(
        PARTICIPANT_ID, GROUP_ID, TENANT_ID, 'amarelo',
      );

      expect(ctx.redis.set).not.toHaveBeenCalled();
    });

    it('skips publish on schema failure without throwing', async () => {
      await expect(
        ctx.publisher.publishRiskResolved(
          PARTICIPANT_ID, GROUP_ID, TENANT_ID,
          'verde' as never, // invalid — schema only allows amarelo|vermelho
        ),
      ).resolves.not.toThrow();
      expect(ctx.redis.publish).not.toHaveBeenCalled();
    });
  });
});
