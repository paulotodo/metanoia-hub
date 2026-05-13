import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "@metanoia/types";
import { requestContext } from "../../../common/context/request-context";
import { FocusHeartbeatController } from "../focus-heartbeat.controller";

const TENANT = "01912345-6789-7000-8000-000000000001";
const MEETING = "01912345-6789-7000-8000-000000000100";
const USER = "01912345-6789-7000-8000-000000000aa1";

function build() {
  const telemetry = {
    recordFocusHeartbeat: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new FocusHeartbeatController(telemetry as never);
  return { controller, telemetry };
}

async function withCtx<T>(userId: string | undefined, fn: () => Promise<T>): Promise<T> {
  return requestContext.run(
    {
      tenantId: TENANT,
      userId: userId ?? '',
      requestId: generateId(),
      correlationId: generateId(),
    },
    fn,
  );
}

describe("FocusHeartbeatController", () => {
  let env: ReturnType<typeof build>;
  beforeEach(() => {
    env = build();
  });

  it("forwards heartbeat to telemetry service with userId from context", async () => {
    await withCtx(USER, () =>
      env.controller.heartbeat(MEETING, {
        visible: true,
        timestamp: "2026-04-20T19:35:00.000Z",
      }),
    );
    expect(env.telemetry.recordFocusHeartbeat).toHaveBeenCalledWith(
      TENANT,
      MEETING,
      USER,
      true,
    );
  });

  it("no-ops silently when userId is missing from context (defensive)", async () => {
    await withCtx(undefined, () =>
      env.controller.heartbeat(MEETING, {
        visible: false,
        timestamp: "2026-04-20T19:35:00.000Z",
      }),
    );
    expect(env.telemetry.recordFocusHeartbeat).not.toHaveBeenCalled();
  });
});
