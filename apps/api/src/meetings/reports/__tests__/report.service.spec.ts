import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { generateId } from "@metanoia/types";
import { requestContext } from "../../../common/context/request-context";
import { ReportService } from "../report.service";

const TENANT = "01912345-6789-7000-8000-000000000001";
const MEETING = "01912345-6789-7000-8000-000000000100";
const USER_1 = "01912345-6789-7000-8000-000000000aa1";
const USER_2 = "01912345-6789-7000-8000-000000000aa2";

function buildMocks() {
  const meetings = { findById: vi.fn() };
  const reports = {
    listAttendanceTelemetry: vi.fn(),
    upsertReport: vi.fn(),
    findByMeeting: vi.fn(),
  };
  const service = new ReportService(meetings as never, reports as never);
  return { service, meetings, reports };
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

describe("ReportService", () => {
  let env: ReturnType<typeof buildMocks>;
  beforeEach(() => {
    env = buildMocks();
  });

  describe("flushReport", () => {
    it("returns null when meeting not found", async () => {
      env.meetings.findById.mockResolvedValue(null);
      const result = await withCtx(() => env.service.flushReport(MEETING));
      expect(result).toBeNull();
    });

    it("aggregates attendance + telemetry into a single upsert", async () => {
      env.meetings.findById.mockResolvedValue({
        startedAt: new Date("2026-04-20T19:30:00.000Z"),
        endedAt: new Date("2026-04-20T20:30:00.000Z"),
        durationMinutes: 60,
      });
      env.reports.listAttendanceTelemetry.mockResolvedValue({
        attendance: [
          {
            userId: USER_1,
            presenceType: "integral",
            totalDurationSeconds: 3600,
          },
          {
            userId: USER_2,
            presenceType: "parcial",
            totalDurationSeconds: 1800,
          },
        ],
        telemetry: [
          {
            userId: USER_1,
            cameraOnSeconds: 3600,
            focusScore: { toString: () => "0.90", valueOf: () => 0.9 },
          },
        ],
      });
      env.reports.upsertReport.mockResolvedValue({ id: "report-1" });

      await withCtx(() => env.service.flushReport(MEETING));

      expect(env.reports.upsertReport).toHaveBeenCalledOnce();
      const arg = env.reports.upsertReport.mock.calls[0]![0] as {
        summary: {
          attendees: Array<{ userId: string; cameraSeconds: number; focusScore: number | null }>;
          totalPresent: number;
          totalPartial: number;
        };
      };
      expect(arg.summary.attendees).toHaveLength(2);
      expect(arg.summary.totalPresent).toBe(1);
      expect(arg.summary.totalPartial).toBe(1);
      const u1 = arg.summary.attendees.find((a) => a.userId === USER_1);
      expect(u1?.cameraSeconds).toBe(3600);
      expect(u1?.focusScore).toBeCloseTo(0.9, 1);
    });
  });

  describe("findForUser", () => {
    it("404 when no report exists", async () => {
      env.reports.findByMeeting.mockResolvedValue(null);
      await expect(
        withCtx(() => env.service.findForUser(MEETING, USER_1, true)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns full kind for canSeeFull=true", async () => {
      env.reports.findByMeeting.mockResolvedValue({
        id: "report-1",
        meetingId: MEETING,
        summary: {
          attendees: [
            {
              userId: USER_1,
              name: null,
              presenceType: "integral",
              durationSeconds: 3600,
              cameraSeconds: 0,
              focusScore: null,
            },
          ],
          totalDurationMinutes: 60,
          avgEngagementScore: 0.5,
          totalPresent: 1,
          totalPartial: 0,
          totalAbsent: 0,
        },
        generatedAt: new Date("2026-04-20T20:35:00.000Z"),
      });
      const result = await withCtx(() =>
        env.service.findForUser(MEETING, USER_1, true),
      );
      expect(result.kind).toBe("full");
    });

    it("returns personal kind shaped to requester for canSeeFull=false", async () => {
      env.reports.findByMeeting.mockResolvedValue({
        id: "report-1",
        meetingId: MEETING,
        summary: {
          attendees: [
            {
              userId: USER_1,
              name: null,
              presenceType: "integral",
              durationSeconds: 3600,
              cameraSeconds: 0,
              focusScore: null,
            },
            {
              userId: USER_2,
              name: null,
              presenceType: "parcial",
              durationSeconds: 1800,
              cameraSeconds: 0,
              focusScore: null,
            },
          ],
          totalDurationMinutes: 60,
          avgEngagementScore: 0.5,
          totalPresent: 1,
          totalPartial: 1,
          totalAbsent: 0,
        },
        generatedAt: new Date("2026-04-20T20:35:00.000Z"),
      });
      const result = await withCtx(() =>
        env.service.findForUser(MEETING, USER_1, false),
      );
      expect(result.kind).toBe("personal");
      if (result.kind === "personal") {
        expect(result.data.attendee.userId).toBe(USER_1);
      }
    });

    it("404 personal when requester is not in attendees", async () => {
      env.reports.findByMeeting.mockResolvedValue({
        id: "report-1",
        meetingId: MEETING,
        summary: {
          attendees: [
            {
              userId: USER_2,
              name: null,
              presenceType: "integral",
              durationSeconds: 3600,
              cameraSeconds: 0,
              focusScore: null,
            },
          ],
          totalDurationMinutes: 60,
          avgEngagementScore: null,
          totalPresent: 1,
          totalPartial: 0,
          totalAbsent: 0,
        },
        generatedAt: new Date("2026-04-20T20:35:00.000Z"),
      });
      await expect(
        withCtx(() => env.service.findForUser(MEETING, USER_1, false)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
