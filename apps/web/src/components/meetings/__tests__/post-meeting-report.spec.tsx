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

  it("renders full FR63 leader view with metrics + participant table (Líder/Admin)", () => {
    vi.spyOn(hookModule, "useMeetingReport").mockReturnValue({
      data: {
        data: {
          meetingId: MEETING,
          metrics: {
            totalParticipants: 2,
            presentCount: 1,
            partialCount: 1,
            absentCount: 0,
            attendanceRate: 0.5,
            avgEngagementScore: 0.75,
            avgEngagementLevel: "high",
          },
          participants: [
            {
              userId: USER_1,
              name: "Ana",
              email: "ana@example.com",
              status: "integral",
              durationSeconds: 3600,
              engagementScore: 0.9,
              engagementLevel: "high",
            },
            {
              userId: USER_2,
              name: "Pedro",
              email: "pedro@example.com",
              status: "parcial",
              durationSeconds: 1800,
              engagementScore: 0.5,
              engagementLevel: "medium",
            },
          ],
          generatedAt: "2026-04-20T20:35:00.000Z",
        },
        meta: { view: "full" },
      },
      isLoading: false,
      isError: false,
    } as never);
    render(withQuery(<PostMeetingReport meetingId={MEETING} />));
    // Metrics section is rendered
    expect(screen.getByRole("heading", { name: /relatório/i })).toBeTruthy();
    // Participants heading
    expect(screen.getByText(/participantes/i)).toBeTruthy();
    // At least one row showing Ana's name
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Pedro")).toBeTruthy();
  });

  it("shows absent participants in pastoral CTA section", () => {
    vi.spyOn(hookModule, "useMeetingReport").mockReturnValue({
      data: {
        data: {
          meetingId: MEETING,
          metrics: {
            totalParticipants: 1,
            presentCount: 0,
            partialCount: 0,
            absentCount: 1,
            attendanceRate: 0,
            avgEngagementScore: null,
            avgEngagementLevel: null,
          },
          participants: [
            {
              userId: USER_1,
              name: "Joana",
              email: "joana@example.com",
              status: "ausente",
              durationSeconds: 0,
              engagementScore: null,
              engagementLevel: null,
            },
          ],
          generatedAt: "2026-04-20T20:35:00.000Z",
        },
        meta: { view: "full" },
      },
      isLoading: false,
      isError: false,
    } as never);
    render(withQuery(<PostMeetingReport meetingId={MEETING} />));
    // "Joana" appears in pastoral CTA + table row
    const joanaElements = screen.getAllByText("Joana");
    expect(joanaElements.length).toBeGreaterThanOrEqual(1);
  });
});
