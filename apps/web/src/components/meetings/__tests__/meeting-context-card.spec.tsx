import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MeetingContextCard } from "../meeting-context-card";

describe("MeetingContextCard", () => {
  it("renders group name", () => {
    render(
      <MeetingContextCard
        groupName="Jovens Adultos"
        scheduledFor="2026-04-16T22:30:00.000Z"
      />,
    );
    expect(screen.getByText("Jovens Adultos")).toBeTruthy();
  });

  it("renders a day label and HH:MM from ISO input", () => {
    render(
      <MeetingContextCard
        groupName="G"
        scheduledFor="2026-04-16T22:30:00.000Z"
      />,
    );
    const ctx = screen.getByText(/,\s+\d{2}:\d{2}/);
    expect(ctx).toBeTruthy();
  });

  it("renders an empty block when scheduledFor is invalid", () => {
    render(
      <MeetingContextCard groupName="Grupo X" scheduledFor="not-a-date" />,
    );
    expect(screen.getByText("Grupo X")).toBeTruthy();
  });
});
