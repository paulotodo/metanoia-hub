import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "@metanoia/types";
import { requestContext } from "../../../common/context/request-context";
import { TelemetryService } from "../telemetry.service";

const TENANT = "01912345-6789-7000-8000-000000000001";
const MEETING = "01912345-6789-7000-8000-000000000100";
const USER_1 = "01912345-6789-7000-8000-000000000aa1";

function buildMocks() {
  const meetings = { findById: vi.fn() };
  const presence = { listAttendance: vi.fn() };
  const telemetry = {
    listTrackEventsByMeeting: vi.fn().mockResolvedValue([]),
    upsertTelemetry: vi.fn(),
  };
  const redis = {
    hgetall: vi.fn().mockResolvedValue({}),
    hincrby: vi.fn().mockResolvedValue(1),
  };
  const service = new TelemetryService(
    meetings as never,
    presence as never,
    telemetry as never,
    redis as never,
  );
  return { service, meetings, presence, telemetry, redis };
}

async function withCtx<T>(fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT,
      userId: "system",
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe("TelemetryService", () => {
  let env: ReturnType<typeof buildMocks>;
  beforeEach(() => {
    env = buildMocks();
  });

  describe("flushTelemetry", () => {
    it("returns [] when meeting not found", async () => {
      env.meetings.findById.mockResolvedValue(null);
      const result = await withCtx(() =>
        env.service.flushTelemetry(MEETING, false),
      );
      expect(result).toEqual([]);
    });

    it("writes telemetry row per attendance entry with focus toggle OFF (focusScore=null)", async () => {
      env.meetings.findById.mockResolvedValue({
        endedAt: new Date("2026-04-20T20:30:00.000Z"),
        tenantId: TENANT,
      });
      env.presence.listAttendance.mockResolvedValue([
        {
          userId: USER_1,
          totalDurationSeconds: 3600,
        },
      ]);
      env.telemetry.upsertTelemetry.mockImplementation(async (input) => input);

      await withCtx(() => env.service.flushTelemetry(MEETING, false));

      const call = env.telemetry.upsertTelemetry.mock.calls[0]![0];
      expect(call.focusScore).toBeNull();
      expect(call.roomDurationSeconds).toBe(3600);
      expect(call.cameraOnSeconds).toBe(0);
    });

    it("filters to video track segments only (audio ignored)", async () => {
      env.meetings.findById.mockResolvedValue({
        endedAt: new Date("2026-04-20T20:30:00.000Z"),
        tenantId: TENANT,
      });
      env.presence.listAttendance.mockResolvedValue([
        { userId: USER_1, totalDurationSeconds: 3600 },
      ]);
      env.telemetry.listTrackEventsByMeeting.mockResolvedValue([
        {
          userId: USER_1,
          eventType: "meetings.track.published",
          payload: { trackKind: "audio" }, // ignored
          createdAt: new Date("2026-04-20T19:30:00.000Z"),
        },
        {
          userId: USER_1,
          eventType: "meetings.track.published",
          payload: { trackKind: "video" },
          createdAt: new Date("2026-04-20T19:32:00.000Z"),
        },
        {
          userId: USER_1,
          eventType: "meetings.track.unpublished",
          payload: { trackKind: "video" },
          createdAt: new Date("2026-04-20T20:02:00.000Z"), // 30 min
        },
      ]);
      env.telemetry.upsertTelemetry.mockImplementation(async (input) => input);

      await withCtx(() => env.service.flushTelemetry(MEETING, false));

      const call = env.telemetry.upsertTelemetry.mock.calls[0]![0];
      expect(call.cameraOnSeconds).toBe(1800);
    });

    it("closes open camera segments using meeting.endedAt", async () => {
      env.meetings.findById.mockResolvedValue({
        endedAt: new Date("2026-04-20T20:30:00.000Z"),
        tenantId: TENANT,
      });
      env.presence.listAttendance.mockResolvedValue([
        { userId: USER_1, totalDurationSeconds: 3600 },
      ]);
      env.telemetry.listTrackEventsByMeeting.mockResolvedValue([
        {
          userId: USER_1,
          eventType: "meetings.track.published",
          payload: { trackKind: "video" },
          createdAt: new Date("2026-04-20T19:30:00.000Z"),
        },
        // no unpublish — camera is still on at meeting end
      ]);
      env.telemetry.upsertTelemetry.mockImplementation(async (input) => input);

      await withCtx(() => env.service.flushTelemetry(MEETING, false));

      const call = env.telemetry.upsertTelemetry.mock.calls[0]![0];
      expect(call.cameraOnSeconds).toBe(3600); // 19:30 → 20:30
    });

    it("reads focus aggregate from Redis when toggle ON and computes focusScore", async () => {
      env.meetings.findById.mockResolvedValue({
        endedAt: new Date("2026-04-20T20:30:00.000Z"),
        tenantId: TENANT,
      });
      env.presence.listAttendance.mockResolvedValue([
        { userId: USER_1, totalDurationSeconds: 3600 },
      ]);
      env.redis.hgetall.mockResolvedValue({ visible: "2700", total: "3600" });
      env.telemetry.upsertTelemetry.mockImplementation(async (input) => input);

      await withCtx(() => env.service.flushTelemetry(MEETING, true));

      expect(env.redis.hgetall).toHaveBeenCalledWith(
        `rt:meeting:${TENANT}:${MEETING}:focus:${USER_1}`,
      );
      const call = env.telemetry.upsertTelemetry.mock.calls[0]![0];
      expect(call.focusScore).toBe(0.75);
    });
  });

  describe("recordFocusHeartbeat", () => {
    it("increments total counter every call", async () => {
      await env.service.recordFocusHeartbeat(TENANT, MEETING, USER_1, false);
      expect(env.redis.hincrby).toHaveBeenCalledWith(
        `rt:meeting:${TENANT}:${MEETING}:focus:${USER_1}`,
        "total",
        30,
      );
    });

    it("increments visible only when visible=true", async () => {
      await env.service.recordFocusHeartbeat(TENANT, MEETING, USER_1, true);
      const calls = env.redis.hincrby.mock.calls.map((c) => c.slice(0, 2));
      expect(calls).toContainEqual([
        `rt:meeting:${TENANT}:${MEETING}:focus:${USER_1}`,
        "total",
      ]);
      expect(calls).toContainEqual([
        `rt:meeting:${TENANT}:${MEETING}:focus:${USER_1}`,
        "visible",
      ]);
    });

    it("does NOT increment visible when visible=false (NFR-L4 default off contract)", async () => {
      await env.service.recordFocusHeartbeat(TENANT, MEETING, USER_1, false);
      const visibleCall = env.redis.hincrby.mock.calls.find(
        (c) => c[1] === "visible",
      );
      expect(visibleCall).toBeUndefined();
    });
  });
});
