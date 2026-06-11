/* eslint-disable @metanoia/no-surveillance-terms --
 * Test exercises the FR-11 gate keyed on the canonical `focus_monitoring`
 * ConsentType enum value. No user-facing surveillance vocabulary. */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TelemetryService } from "../telemetry.service";

/**
 * FR-11 integration: focus_monitoring withdrawal gate.
 *
 * Scenario (tasks 4.2.1–4.2.5):
 *   - User A has withdrawn focus_monitoring consent (a `withdrawn` row exists
 *     in consent_records).
 *   - User A and User B both emit a focus heartbeat for the same meeting.
 *   - Only User B's heartbeat is persisted into the Redis focus aggregate;
 *     User A's heartbeat is silently dropped (revocation effective).
 *
 * Redis is replaced by an in-memory hash store so the assertion targets the
 * actual aggregate keyed on `rt:meeting:{tenant}:{meeting}:focus:{user}`.
 * The consent state is a real lookup table keyed on (userId, consentType)
 * driving `ConsentRepository.hasWithdrawn`.
 */

const TENANT = "01912345-6789-7000-8000-000000000001";
const MEETING = "01912345-6789-7000-8000-000000000100";
const USER_A = "01912345-6789-7000-8000-00000000000a"; // withdrew consent
const USER_B = "01912345-6789-7000-8000-00000000000b"; // active consent

/** In-memory stand-in for RedisService hash ops used by TelemetryService. */
function buildInMemoryRedis() {
  const store = new Map<string, Record<string, number>>();
  return {
    store,
    hincrby: vi.fn(async (key: string, field: string, by: number) => {
      const hash = store.get(key) ?? {};
      hash[field] = (hash[field] ?? 0) + by;
      store.set(key, hash);
      return hash[field];
    }),
    hgetall: vi.fn(async (key: string) => store.get(key) ?? {}),
  };
}

/** In-memory consent_records gate driving hasWithdrawn(). */
function buildConsentRepo(withdrawn: Set<string>) {
  return {
    hasWithdrawn: vi.fn(
      async (userId: string, consentType: string) =>
        withdrawn.has(`${userId}:${consentType}`),
    ),
  };
}

describe("FR-11 focus heartbeat consent gate (integration)", () => {
  let redis: ReturnType<typeof buildInMemoryRedis>;
  let consentRepo: ReturnType<typeof buildConsentRepo>;
  let service: TelemetryService;

  beforeEach(() => {
    redis = buildInMemoryRedis();
    // User A revoked focus_monitoring (direct withdrawal record).
    consentRepo = buildConsentRepo(new Set([`${USER_A}:focus_monitoring`]));
    service = new TelemetryService(
      {} as never, // meetings — unused by recordFocusHeartbeat
      {} as never, // presence — unused
      {} as never, // telemetry repo — unused
      redis as never,
      consentRepo as never,
    );
  });

  function keyFor(userId: string): string {
    return `rt:meeting:${TENANT}:${MEETING}:focus:${userId}`;
  }

  it("persists only User B's heartbeat when User A withdrew consent", async () => {
    await service.recordFocusHeartbeat(TENANT, MEETING, USER_A, true);
    await service.recordFocusHeartbeat(TENANT, MEETING, USER_B, true);

    // User B: aggregate written.
    expect(redis.store.get(keyFor(USER_B))).toEqual({ total: 30, visible: 30 });
    // User A: revocation effective — no aggregate at all.
    expect(redis.store.has(keyFor(USER_A))).toBe(false);
  });

  it("checks consent before touching Redis for the withdrawn user", async () => {
    await service.recordFocusHeartbeat(TENANT, MEETING, USER_A, true);

    expect(consentRepo.hasWithdrawn).toHaveBeenCalledWith(
      USER_A,
      "focus_monitoring",
    );
    expect(redis.hincrby).not.toHaveBeenCalled();
  });

  it("keeps recording across multiple heartbeats for the consenting user", async () => {
    await service.recordFocusHeartbeat(TENANT, MEETING, USER_B, true);
    await service.recordFocusHeartbeat(TENANT, MEETING, USER_B, false);
    await service.recordFocusHeartbeat(TENANT, MEETING, USER_B, true);

    // total accrues every call (3 × 30); visible only on visible=true (2 × 30).
    expect(redis.store.get(keyFor(USER_B))).toEqual({ total: 90, visible: 60 });
    // User A remains absent throughout.
    expect(redis.store.has(keyFor(USER_A))).toBe(false);
  });
});
