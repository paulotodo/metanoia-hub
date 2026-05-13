import { describe, expect, it } from "vitest";
import {
  MEETING_REMINDER_MINUTES,
  MeetingReportAttendeeSchema,
  MeetingReportSummarySchema,
  MeetingReportSchema,
  MeetingReportPersonalSchema,
  computeReportSummary,
} from "../meeting-report";

describe("MEETING_REMINDER_MINUTES (Story 5.6)", () => {
  it("defaults to 30 min before scheduled start", () => {
    expect(MEETING_REMINDER_MINUTES).toBe(30);
  });
});

describe("MeetingReportAttendeeSchema snapshot", () => {
  it("accepts null name + null focus", () => {
    const ok = MeetingReportAttendeeSchema.safeParse({
      userId: "019756c0-0002-7000-8000-000000000001",
      name: null,
      presenceType: "parcial",
      durationSeconds: 1800,
      cameraSeconds: 600,
      focusScore: null,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects focusScore out of bounds", () => {
    const fail = MeetingReportAttendeeSchema.safeParse({
      userId: "019756c0-0002-7000-8000-000000000001",
      name: "Ana",
      presenceType: "integral",
      durationSeconds: 1800,
      cameraSeconds: 600,
      focusScore: 1.5,
    });
    expect(fail.success).toBe(false);
  });
});

describe("MeetingReportSummarySchema snapshot", () => {
  it("parses an empty summary", () => {
    const ok = MeetingReportSummarySchema.safeParse({
      attendees: [],
      totalDurationMinutes: 0,
      avgEngagementScore: null,
      totalPresent: 0,
      totalPartial: 0,
      totalAbsent: 0,
    });
    expect(ok.success).toBe(true);
  });
});

describe("MeetingReportSchema + Personal snapshot", () => {
  it("freezes the full report shape", () => {
    const ok = MeetingReportSchema.safeParse({
      id: "019756c0-0002-7000-8000-000000000001",
      tenantId: "019756c0-0002-7000-8000-000000000aaa",
      meetingId: "019756c0-0002-7000-8000-000000000002",
      summary: {
        attendees: [],
        totalDurationMinutes: 60,
        avgEngagementScore: 0.75,
        totalPresent: 5,
        totalPartial: 2,
        totalAbsent: 1,
      },
      generatedAt: "2026-04-20T20:35:00.000Z",
    });
    expect(ok.success).toBe(true);
  });

  it("parses the personal view payload", () => {
    const ok = MeetingReportPersonalSchema.safeParse({
      meetingId: "019756c0-0002-7000-8000-000000000002",
      attendee: {
        userId: "019756c0-0002-7000-8000-000000000bbb",
        name: "Ana",
        presenceType: "integral",
        durationSeconds: 3600,
        cameraSeconds: 1800,
        focusScore: 0.8,
      },
      generatedAt: "2026-04-20T20:35:00.000Z",
    });
    expect(ok.success).toBe(true);
  });
});

describe("computeReportSummary (Story 5.6 pure)", () => {
  it("returns empty totals + null avgEngagementScore for empty input", () => {
    const result = computeReportSummary({
      rows: [],
      meetingDurationSeconds: 3600,
    });
    expect(result).toMatchObject({
      attendees: [],
      totalPresent: 0,
      totalPartial: 0,
      totalAbsent: 0,
      avgEngagementScore: null,
    });
  });

  it("counts presence types across attendees", () => {
    const result = computeReportSummary({
      rows: [
        {
          userId: "u-1",
          presenceType: "integral",
          durationSeconds: 3600,
          cameraSeconds: 3600,
          focusScore: 1,
        },
        {
          userId: "u-2",
          presenceType: "parcial",
          durationSeconds: 1800,
          cameraSeconds: 0,
          focusScore: null,
        },
        {
          userId: "u-3",
          presenceType: "ausente",
          durationSeconds: 0,
          cameraSeconds: 0,
          focusScore: null,
        },
      ],
      meetingDurationSeconds: 3600,
    });
    expect(result.totalPresent).toBe(1);
    expect(result.totalPartial).toBe(1);
    expect(result.totalAbsent).toBe(1);
  });

  it("computes weighted avgEngagementScore (presence*0.5 + camera*0.25 + focus*0.25)", () => {
    const result = computeReportSummary({
      rows: [
        {
          userId: "u-1",
          presenceType: "integral",
          durationSeconds: 3600,
          cameraSeconds: 3600,
          focusScore: 1,
        },
      ],
      meetingDurationSeconds: 3600,
    });
    // presenceFrac=1, cameraFrac=1, focus=1 → 0.5+0.25+0.25 = 1
    expect(result.avgEngagementScore).toBe(1);
  });

  it("uses 0.5 as neutral when focusScore is null", () => {
    const result = computeReportSummary({
      rows: [
        {
          userId: "u-1",
          presenceType: "integral",
          durationSeconds: 3600,
          cameraSeconds: 0,
          focusScore: null,
        },
      ],
      meetingDurationSeconds: 3600,
    });
    // presence=1, camera=0, focus(null)→0.5 → 0.5+0+0.125 = 0.625
    expect(result.avgEngagementScore).toBe(0.63);
  });

  it("rounds totalDurationMinutes to integer", () => {
    const result = computeReportSummary({
      rows: [],
      meetingDurationSeconds: 90,
    });
    expect(result.totalDurationMinutes).toBe(2);
  });
});
