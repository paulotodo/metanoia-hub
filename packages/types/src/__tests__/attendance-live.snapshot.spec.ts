import { describe, expect, it } from "vitest";
import {
  AttendanceLiveSnapshotSchema,
  AttendanceLiveDeltaSchema,
  AttendanceLiveEventSchema,
  LiveParticipantSchema,
  LiveParticipantStatusSchema,
} from "../attendance-live";

describe("LiveParticipantStatusSchema snapshot", () => {
  it("freezes the enum values", () => {
    expect(LiveParticipantStatusSchema.options).toMatchInlineSnapshot(`
      [
        "na-sala",
        "saiu",
      ]
    `);
  });
});

describe("LiveParticipantSchema snapshot", () => {
  it("accepts null name + null leftAt", () => {
    const ok = LiveParticipantSchema.safeParse({
      userId: "u-1",
      name: null,
      status: "na-sala",
      currentDurationSeconds: 60,
      cameraOn: false,
      joinedAt: "2026-04-20T19:30:00.000Z",
      leftAt: null,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects negative durations", () => {
    const fail = LiveParticipantSchema.safeParse({
      userId: "u-1",
      name: "Ana",
      status: "na-sala",
      currentDurationSeconds: -1,
      cameraOn: false,
      joinedAt: "2026-04-20T19:30:00.000Z",
      leftAt: null,
    });
    expect(fail.success).toBe(false);
  });
});

describe("AttendanceLiveSnapshotSchema snapshot", () => {
  it("parses an empty snapshot", () => {
    const ok = AttendanceLiveSnapshotSchema.safeParse({
      type: "snapshot",
      meetingId: "019756c0-0002-7000-8000-000000000002",
      capturedAt: "2026-04-20T19:35:00.000Z",
      participants: [],
    });
    expect(ok.success).toBe(true);
  });
});

describe("AttendanceLiveDeltaSchema snapshot", () => {
  it("parses participant.joined delta", () => {
    const ok = AttendanceLiveDeltaSchema.safeParse({
      type: "participant.joined",
      meetingId: "019756c0-0002-7000-8000-000000000002",
      userId: "u-1",
      timestamp: "2026-04-20T19:36:00.000Z",
    });
    expect(ok.success).toBe(true);
  });

  it("parses participant.left delta", () => {
    const ok = AttendanceLiveDeltaSchema.safeParse({
      type: "participant.left",
      meetingId: "019756c0-0002-7000-8000-000000000002",
      userId: "u-1",
      timestamp: "2026-04-20T19:36:00.000Z",
    });
    expect(ok.success).toBe(true);
  });
});

describe("AttendanceLiveEventSchema snapshot (union)", () => {
  it("accepts both snapshot and delta shapes", () => {
    const snap = AttendanceLiveEventSchema.safeParse({
      type: "snapshot",
      meetingId: "019756c0-0002-7000-8000-000000000002",
      capturedAt: "2026-04-20T19:35:00.000Z",
      participants: [],
    });
    const delta = AttendanceLiveEventSchema.safeParse({
      type: "participant.joined",
      meetingId: "019756c0-0002-7000-8000-000000000002",
      userId: "u-1",
      timestamp: "2026-04-20T19:36:00.000Z",
    });
    expect({ snap: snap.success, delta: delta.success }).toEqual({
      snap: true,
      delta: true,
    });
  });
});
