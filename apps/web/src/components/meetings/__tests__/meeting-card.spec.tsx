import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MeetingResponse } from "@metanoia/types";
import { MeetingCard } from "../meeting-card";

function meeting(overrides: Partial<MeetingResponse> = {}): MeetingResponse {
  return {
    id: "019756c0-0002-7000-8000-000000000001",
    tenantId: "019756c0-0002-7000-8000-000000000aaa",
    groupId: "019756c0-0002-7000-8000-000000000002",
    title: "Encontro semanal",
    scheduledFor: "2026-04-20T19:30:00.000Z",
    durationMinutes: 60,
    status: "scheduled",
    topic: null,
    providerRoomId: null,
    startedAt: null,
    endedAt: null,
    cancelledAt: null,
    createdBy: null,
    createdAt: "2026-04-19T12:00:00.000Z",
    updatedAt: "2026-04-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("MeetingCard", () => {
  it("renders title, date, time and duration", () => {
    render(<MeetingCard meeting={meeting()} />);
    expect(screen.getByText("Encontro semanal")).toBeTruthy();
    expect(screen.getByText(/60 min/)).toBeTruthy();
  });

  it("falls back to topic when title is null", () => {
    render(<MeetingCard meeting={meeting({ title: null, topic: "Marcos 4" })} />);
    expect(screen.getByText("Marcos 4")).toBeTruthy();
  });

  it("shows scheduled status label for scheduled meetings", () => {
    render(<MeetingCard meeting={meeting({ status: "scheduled" })} />);
    expect(screen.getByText("Agendada")).toBeTruthy();
  });

  it("hides join button when meeting is not live", () => {
    render(<MeetingCard meeting={meeting({ status: "scheduled" })} onJoin={() => {}} />);
    expect(screen.queryByTestId("meeting-card-join")).toBeNull();
  });

  it("renders join button for live meetings and calls onJoin", () => {
    const onJoin = vi.fn();
    render(<MeetingCard meeting={meeting({ status: "live" })} onJoin={onJoin} />);
    const btn = screen.getByTestId("meeting-card-join");
    fireEvent.click(btn);
    expect(onJoin).toHaveBeenCalledWith("019756c0-0002-7000-8000-000000000001");
  });

  it("disables join button when isJoining", () => {
    render(
      <MeetingCard
        meeting={meeting({ status: "live" })}
        onJoin={() => {}}
        isJoining={true}
      />,
    );
    const btn = screen.getByTestId("meeting-card-join") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Entrando");
  });

  it("renders cancelled status with the right label", () => {
    render(<MeetingCard meeting={meeting({ status: "cancelled" })} />);
    expect(screen.getByText("Cancelada")).toBeTruthy();
  });
});
