import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostMeetingReport } from "../post-meeting-report";
import * as hookModule from "@/lib/api/hooks/use-meeting-report";

const MEETING = "019756c0-0002-7000-8000-000000000002";
const USER_1 = "019756c0-0002-7000-8000-000000000aa1";
const USER_2 = "019756c0-0002-7000-8000-000000000aa2";

function withQuery(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("PostMeetingReport", () => {
  it("renders loading state initially", () => {
    vi.spyOn(hookModule, "useMeetingReport").mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as never);
    render(withQuery(<PostMeetingReport meetingId={MEETING} />));
    expect(screen.getByTestId("report-loading")).toBeTruthy();
  });

  it("renders error state on failure", () => {
    vi.spyOn(hookModule, "useMeetingReport").mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    render(withQuery(<PostMeetingReport meetingId={MEETING} />));
    expect(screen.getByTestId("report-error")).toBeTruthy();
  });

  it("renders personal view with single attendee card (Participante)", () => {
    vi.spyOn(hookModule, "useMeetingReport").mockReturnValue({
      data: {
        data: {
          meetingId: MEETING,
          attendee: {
            userId: USER_1,
            name: "Ana",
            presenceType: "integral",
            durationSeconds: 3600,
            cameraSeconds: 1800,
            focusScore: 0.8,
          },
          generatedAt: "2026-04-20T20:35:00.000Z",
        },
        meta: { view: "personal" },
      },
      isLoading: false,
      isError: false,
    } as never);
    render(withQuery(<PostMeetingReport meetingId={MEETING} />));
    expect(screen.getByTestId("post-meeting-report-personal")).toBeTruthy();
    expect(screen.getByText("Integral")).toBeTruthy();
    expect(screen.getByText("60 min")).toBeTruthy();
    expect(screen.getByText("30 min")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
  });

  it("renders full view with table + aggregated metrics (Líder/Admin)", () => {
    vi.spyOn(hookModule, "useMeetingReport").mockReturnValue({
      data: {
        data: {
          id: "report-1",
          meetingId: MEETING,
          summary: {
            attendees: [
              {
                userId: USER_1,
                name: "Ana",
                presenceType: "integral",
                durationSeconds: 3600,
                cameraSeconds: 3600,
                focusScore: 0.9,
              },
              {
                userId: USER_2,
                name: "Pedro",
                presenceType: "parcial",
                durationSeconds: 1800,
                cameraSeconds: 0,
                focusScore: null,
              },
            ],
            totalDurationMinutes: 60,
            avgEngagementScore: 0.75,
            totalPresent: 1,
            totalPartial: 1,
            totalAbsent: 0,
          },
          generatedAt: "2026-04-20T20:35:00.000Z",
        },
        meta: { view: "full" },
      },
      isLoading: false,
      isError: false,
    } as never);
    render(withQuery(<PostMeetingReport meetingId={MEETING} />));
    expect(screen.getByTestId("post-meeting-report-full")).toBeTruthy();
    expect(screen.getByTestId("post-meeting-report-table")).toBeTruthy();
    const rows = screen.getAllByTestId("post-meeting-report-row");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("75%")).toBeTruthy();
  });

  it("shows '—' for null focusScore in full view", () => {
    vi.spyOn(hookModule, "useMeetingReport").mockReturnValue({
      data: {
        data: {
          id: "report-1",
          meetingId: MEETING,
          summary: {
            attendees: [
              {
                userId: USER_1,
                name: "Ana",
                presenceType: "integral",
                durationSeconds: 3600,
                cameraSeconds: 3600,
                focusScore: null,
              },
            ],
            totalDurationMinutes: 60,
            avgEngagementScore: null,
            totalPresent: 1,
            totalPartial: 0,
            totalAbsent: 0,
          },
          generatedAt: "2026-04-20T20:35:00.000Z",
        },
        meta: { view: "full" },
      },
      isLoading: false,
      isError: false,
    } as never);
    render(withQuery(<PostMeetingReport meetingId={MEETING} />));
    const noFocusCells = screen.getAllByText("—");
    expect(noFocusCells.length).toBeGreaterThanOrEqual(2);
  });
});
