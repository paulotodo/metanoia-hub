import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateId } from "@metanoia/types";
import { requestContext } from "../../../common/context/request-context";
import { AttendanceLiveService } from "../attendance-live.service";

const TENANT = "01912345-6789-7000-8000-000000000001";
const MEETING = "01912345-6789-7000-8000-000000000100";

function buildService(hgetallResult: Record<string, string>) {
  const redis = {
    hgetall: vi.fn().mockResolvedValue(hgetallResult),
  };
  const service = new AttendanceLiveService(redis as never);
  return { service, redis };
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

describe("AttendanceLiveService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T19:36:00.000Z"));
  });

  it("reads from Redis presence hash with the canonical key", async () => {
    const { service, redis } = buildService({});
    await withCtx(() => service.snapshot(MEETING));
    expect(redis.hgetall).toHaveBeenCalledWith(
      `rt:meeting:${TENANT}:${MEETING}:presence`,
    );
  });

  it("returns an empty snapshot when no presence data exists", async () => {
    const { service } = buildService({});
    const result = await withCtx(() => service.snapshot(MEETING));
    expect(result).toMatchObject({
      type: "snapshot",
      meetingId: MEETING,
      participants: [],
    });
  });

  it("derives status from leftAt and computes current duration", async () => {
    const { service } = buildService({
      "user-1": JSON.stringify({
        joinedAt: "2026-04-20T19:32:00.000Z",
        name: "Ana",
        cameraOn: true,
      }),
      "user-2": JSON.stringify({
        joinedAt: "2026-04-20T19:30:00.000Z",
        leftAt: "2026-04-20T19:34:00.000Z",
        name: "Pedro",
      }),
    });
    const result = await withCtx(() => service.snapshot(MEETING));
    const ana = result.participants.find((p) => p.userId === "user-1");
    const pedro = result.participants.find((p) => p.userId === "user-2");

    expect(ana).toMatchObject({
      status: "na-sala",
      cameraOn: true,
      currentDurationSeconds: 240, // 19:32 → 19:36 (now)
    });
    expect(pedro).toMatchObject({
      status: "saiu",
      cameraOn: false,
      currentDurationSeconds: 240, // 19:30 → 19:34
    });
  });

  it("survives corrupt presence hash values", async () => {
    const { service } = buildService({
      "user-broken": "not-json",
    });
    const result = await withCtx(() => service.snapshot(MEETING));
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0]?.userId).toBe("user-broken");
  });
});
