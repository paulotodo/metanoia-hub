import { describe, expect, it } from "vitest";
import {
  EngagementLevelSchema,
  MeetingReportParticipantFR63Schema,
  MeetingReportMetricsSchema,
  MeetingLeaderReportResponseSchema,
  classifyEngagementLevel,
  computeParticipantEngagement,
} from "../meeting-report-fr63";

const MEETING_ID = "019756c0-0002-7000-8000-000000000002";
const USER_ID = "019756c0-0002-7000-8000-000000000bbb";

describe("EngagementLevelSchema", () => {
  it("accepts all valid levels", () => {
    expect(EngagementLevelSchema.parse("low")).toBe("low");
    expect(EngagementLevelSchema.parse("medium")).toBe("medium");
    expect(EngagementLevelSchema.parse("high")).toBe("high");
  });

  it("rejects unknown levels", () => {
    expect(EngagementLevelSchema.safeParse("none").success).toBe(false);
    expect(EngagementLevelSchema.safeParse("").success).toBe(false);
  });
});

describe("MeetingReportParticipantFR63Schema snapshot", () => {
  const validParticipant = {
    userId: USER_ID,
    name: "Ana Ferreira",
    email: "ana@example.com",
    status: "integral" as const,
    joinedAt: "2026-04-20T19:30:00.000Z",
    leftAt: "2026-04-20T20:30:00.000Z",
    durationSeconds: 3600,
    engagementScore: 0.85,
    engagementLevel: "high" as const,
  };

  it("accepts a valid participant row", () => {
    const result = MeetingReportParticipantFR63Schema.safeParse(validParticipant);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchSnapshot();
    }
  });

  it("accepts null name, email, joinedAt, leftAt, engagementScore, engagementLevel", () => {
    const result = MeetingReportParticipantFR63Schema.safeParse({
      ...validParticipant,
      name: null,
      email: null,
      joinedAt: null,
      leftAt: null,
      engagementScore: null,
      engagementLevel: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all three status values", () => {
    for (const status of ["integral", "parcial", "ausente"] as const) {
      const r = MeetingReportParticipantFR63Schema.safeParse({
        ...validParticipant,
        status,
      });
      expect(r.success).toBe(true);
    }
  });

  it("rejects engagementScore > 1", () => {
    const r = MeetingReportParticipantFR63Schema.safeParse({
      ...validParticipant,
      engagementScore: 1.1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const r = MeetingReportParticipantFR63Schema.safeParse({
      ...validParticipant,
      email: "not-an-email",
    });
    expect(r.success).toBe(false);
  });
});

describe("MeetingReportMetricsSchema snapshot", () => {
  const validMetrics = {
    totalParticipants: 10,
    presentCount: 7,
    partialCount: 2,
    absentCount: 1,
    attendanceRate: 0.9,
    avgEngagementScore: 0.72,
    avgEngagementLevel: "medium" as const,
  };

  it("accepts valid metrics and matches snapshot", () => {
    const result = MeetingReportMetricsSchema.safeParse(validMetrics);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchSnapshot();
    }
  });

  it("accepts null avgEngagementScore and avgEngagementLevel", () => {
    const r = MeetingReportMetricsSchema.safeParse({
      ...validMetrics,
      avgEngagementScore: null,
      avgEngagementLevel: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects attendanceRate > 1", () => {
    const r = MeetingReportMetricsSchema.safeParse({
      ...validMetrics,
      attendanceRate: 1.5,
    });
    expect(r.success).toBe(false);
  });
});

describe("MeetingLeaderReportResponseSchema snapshot", () => {
  const validResponse = {
    data: {
      meetingId: MEETING_ID,
      metrics: {
        totalParticipants: 2,
        presentCount: 1,
        partialCount: 1,
        absentCount: 0,
        attendanceRate: 1.0,
        avgEngagementScore: 0.65,
        avgEngagementLevel: "medium" as const,
      },
      participants: [
        {
          userId: USER_ID,
          name: "Ana",
          email: "ana@example.com",
          status: "integral" as const,
          joinedAt: "2026-04-20T19:30:00.000Z",
          leftAt: "2026-04-20T20:30:00.000Z",
          durationSeconds: 3600,
          engagementScore: 0.85,
          engagementLevel: "high" as const,
        },
      ],
      generatedAt: "2026-04-20T20:35:00.000Z",
    },
  };

  it("accepts valid leader report response and matches snapshot", () => {
    const result = MeetingLeaderReportResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchSnapshot();
    }
  });

  it("accepts empty participants array", () => {
    const r = MeetingLeaderReportResponseSchema.safeParse({
      data: { ...validResponse.data, participants: [] },
    });
    expect(r.success).toBe(true);
  });
});

describe("classifyEngagementLevel (FR-03 thresholds)", () => {
  it("classifies < 0.4 as low", () => {
    expect(classifyEngagementLevel(0)).toBe("low");
    expect(classifyEngagementLevel(0.39)).toBe("low");
  });

  it("classifies 0.4..0.75 as medium", () => {
    expect(classifyEngagementLevel(0.4)).toBe("medium");
    expect(classifyEngagementLevel(0.75)).toBe("medium");
  });

  it("classifies > 0.75 as high", () => {
    expect(classifyEngagementLevel(0.76)).toBe("high");
    expect(classifyEngagementLevel(1.0)).toBe("high");
  });
});

describe("computeParticipantEngagement (FR-03 formula)", () => {
  it("returns null for zero meetingDurationSeconds", () => {
    expect(computeParticipantEngagement(3600, 1800, 0)).toBeNull();
  });

  it("computes score=1 for full presence + full camera", () => {
    const result = computeParticipantEngagement(3600, 3600, 3600);
    expect(result).not.toBeNull();
    // presenceFrac=1, cameraFrac=1 → 0.7*1 + 0.3*1 = 1.0
    expect(result?.score).toBeCloseTo(1.0, 2);
    expect(result?.level).toBe("high");
  });

  it("computes score=0.7 for full presence + zero camera → medium", () => {
    const result = computeParticipantEngagement(3600, 0, 3600);
    expect(result).not.toBeNull();
    // presenceFrac=1, cameraFrac=0 → 0.7*1 + 0.3*0 = 0.7
    // FR-03 thresholds: low < 0.4, medium [0.4..0.75], high > 0.75
    // 0.7 is in medium range
    expect(result?.score).toBeCloseTo(0.7, 2);
    expect(result?.level).toBe("medium");
  });

  it("classifies 0.7 as medium (boundary: > 0.75 = high, else medium if >= 0.4)", () => {
    const result = computeParticipantEngagement(3600, 0, 3600);
    // 0.7*1 + 0.3*0 = 0.7 → medium (0.4 ≤ 0.7 ≤ 0.75)
    expect(result?.level).toBe("medium");
  });

  it("computes score=0 for zero presence (ausente)", () => {
    const result = computeParticipantEngagement(0, 0, 3600);
    expect(result?.score).toBeCloseTo(0, 2);
    expect(result?.level).toBe("low");
  });

  it("clamps presenceFrac at 1 if durationSeconds > meetingDuration", () => {
    // Edge: participant connected longer than meeting duration
    const result = computeParticipantEngagement(7200, 7200, 3600);
    expect(result?.score).toBeCloseTo(1.0, 2);
  });
});
