import { describe, expect, it } from "vitest";
import {
  FocusHeartbeatSchema,
  MeetingTelemetrySchema,
  computeTelemetry,
} from "../telemetry";

describe("FocusHeartbeatSchema snapshot", () => {
  it("accepts visible boolean + ISO timestamp", () => {
    const ok = FocusHeartbeatSchema.safeParse({
      visible: true,
      timestamp: "2026-04-20T19:35:00.000Z",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects non-boolean visible", () => {
    const fail = FocusHeartbeatSchema.safeParse({
      visible: "yes",
      timestamp: "2026-04-20T19:35:00.000Z",
    });
    expect(fail.success).toBe(false);
  });

  it("rejects malformed timestamp", () => {
    const fail = FocusHeartbeatSchema.safeParse({
      visible: false,
      timestamp: "not-a-date",
    });
    expect(fail.success).toBe(false);
  });
});

describe("MeetingTelemetrySchema snapshot", () => {
  it("accepts null focusScore (focus toggle off)", () => {
    const ok = MeetingTelemetrySchema.safeParse({
      id: "019756c0-0002-7000-8000-000000000001",
      tenantId: "019756c0-0002-7000-8000-000000000aaa",
      meetingId: "019756c0-0002-7000-8000-000000000002",
      userId: "019756c0-0002-7000-8000-000000000bbb",
      cameraOnSeconds: 1800,
      roomDurationSeconds: 3600,
      focusScore: null,
      createdAt: "2026-04-20T20:31:00.000Z",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects focusScore > 1", () => {
    const fail = MeetingTelemetrySchema.safeParse({
      id: "019756c0-0002-7000-8000-000000000001",
      tenantId: "019756c0-0002-7000-8000-000000000aaa",
      meetingId: "019756c0-0002-7000-8000-000000000002",
      userId: "019756c0-0002-7000-8000-000000000bbb",
      cameraOnSeconds: 1800,
      roomDurationSeconds: 3600,
      focusScore: 1.2,
      createdAt: "2026-04-20T20:31:00.000Z",
    });
    expect(fail.success).toBe(false);
  });
});

describe("computeTelemetry (Story 5.4 pure)", () => {
  it("sums camera segments into cameraOnSeconds", () => {
    const result = computeTelemetry({
      cameraSegments: [
        { start: "2026-04-20T19:30:00.000Z", end: "2026-04-20T19:45:00.000Z" }, // 900s
        { start: "2026-04-20T20:00:00.000Z", end: "2026-04-20T20:15:00.000Z" }, // 900s
      ],
      roomDurationSeconds: 3600,
      focusVisibleSeconds: null,
      focusTotalSeconds: null,
    });
    expect(result.cameraOnSeconds).toBe(1800);
  });

  it("returns focusScore=null when inputs are null (toggle off)", () => {
    const result = computeTelemetry({
      cameraSegments: [],
      roomDurationSeconds: 3600,
      focusVisibleSeconds: null,
      focusTotalSeconds: null,
    });
    expect(result.focusScore).toBeNull();
  });

  it("computes focusScore = visible/total with 2 decimal precision", () => {
    const result = computeTelemetry({
      cameraSegments: [],
      roomDurationSeconds: 3600,
      focusVisibleSeconds: 2700,
      focusTotalSeconds: 3600,
    });
    expect(result.focusScore).toBe(0.75);
  });

  it("clamps focusScore to [0, 1]", () => {
    const above = computeTelemetry({
      cameraSegments: [],
      roomDurationSeconds: 3600,
      focusVisibleSeconds: 4000,
      focusTotalSeconds: 3600,
    });
    expect(above.focusScore).toBe(1);
  });

  it("focusScore is null when totalSeconds is 0 (no heartbeats yet)", () => {
    const result = computeTelemetry({
      cameraSegments: [],
      roomDurationSeconds: 3600,
      focusVisibleSeconds: 0,
      focusTotalSeconds: 0,
    });
    expect(result.focusScore).toBeNull();
  });

  it("rounds roomDurationSeconds and cameraOnSeconds", () => {
    const result = computeTelemetry({
      cameraSegments: [
        { start: "2026-04-20T19:30:00.000Z", end: "2026-04-20T19:30:01.500Z" },
      ],
      roomDurationSeconds: 3600.7,
      focusVisibleSeconds: null,
      focusTotalSeconds: null,
    });
    expect(result.cameraOnSeconds).toBe(2);
    expect(result.roomDurationSeconds).toBe(3601);
  });
});
