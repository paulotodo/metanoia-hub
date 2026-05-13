import { describe, it, expect, vi, beforeEach } from "vitest";
import { MeetingReminderService } from "../meeting-reminder.service";

const TENANT = "01912345-6789-7000-8000-000000000001";
const MEETING = "01912345-6789-7000-8000-000000000100";
const GROUP = "01912345-6789-7000-8000-000000000200";

function build(now: Date) {
  vi.setSystemTime(now);
  const queueAdd = vi.fn().mockResolvedValue({ id: "job-1" });
  const bullMq = { createQueue: vi.fn(() => ({ add: queueAdd })) };
  const service = new MeetingReminderService(bullMq as never);
  return { service, queueAdd, bullMq };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("MeetingReminderService", () => {
  it("creates queue 'notifications' on construction", () => {
    const env = build(new Date("2026-04-20T19:00:00.000Z"));
    expect(env.bullMq.createQueue).toHaveBeenCalledWith("notifications");
  });

  it("enqueues delayed job 30min before scheduledFor", async () => {
    const env = build(new Date("2026-04-20T19:00:00.000Z"));
    await env.service.scheduleReminder({
      tenantId: TENANT,
      meetingId: MEETING,
      groupId: GROUP,
      scheduledFor: "2026-04-20T20:00:00.000Z", // 60min ahead
    });
    expect(env.queueAdd).toHaveBeenCalledOnce();
    const [name, payload, opts] = env.queueAdd.mock.calls[0]!;
    expect(name).toBe("meeting-reminder");
    expect((payload as { meetingId: string }).meetingId).toBe(MEETING);
    // 60min - 30min reminder = 30min delay = 1_800_000ms
    expect((opts as { delay: number }).delay).toBe(30 * 60 * 1000);
    expect((opts as { jobId: string }).jobId).toBe(
      `meeting-reminder:${MEETING}`,
    );
  });

  it("clamps delay to 0 when scheduledFor is already past + reminder window", async () => {
    const env = build(new Date("2026-04-20T21:00:00.000Z"));
    await env.service.scheduleReminder({
      tenantId: TENANT,
      meetingId: MEETING,
      groupId: GROUP,
      scheduledFor: "2026-04-20T20:00:00.000Z",
    });
    const opts = env.queueAdd.mock.calls[0]![2] as { delay: number };
    expect(opts.delay).toBe(0);
  });

  it("skips schedule (returns null) when scheduledFor is malformed", async () => {
    const env = build(new Date("2026-04-20T19:00:00.000Z"));
    const result = await env.service.scheduleReminder({
      tenantId: TENANT,
      meetingId: MEETING,
      groupId: GROUP,
      scheduledFor: "not-a-date",
    });
    expect(result).toBeNull();
    expect(env.queueAdd).not.toHaveBeenCalled();
  });
});
