import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveStatusBar } from "../live-status-bar";

describe("LiveStatusBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders label and initial duration", () => {
    const startedAt = new Date("2026-04-16T22:30:00.000Z").toISOString();
    vi.setSystemTime(new Date("2026-04-16T22:30:00.000Z"));

    render(
      <LiveStatusBar
        startedAt={startedAt}
        label="Reunião em andamento"
        detailsTemplate="Há {duration}"
      />,
    );

    expect(screen.getByText("Reunião em andamento")).toBeTruthy();
    expect(screen.getByTestId("live-duration").textContent).toBe("Há 00:00");
  });

  it("increments duration after 1s interval", () => {
    const startedAt = new Date("2026-04-16T22:30:00.000Z").toISOString();
    vi.setSystemTime(new Date("2026-04-16T22:30:00.000Z"));

    render(
      <LiveStatusBar
        startedAt={startedAt}
        label="Live"
        detailsTemplate="{duration}"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("live-duration").textContent).toBe("00:05");
  });

  it("shows connecting label when startedAt is invalid", () => {
    render(
      <LiveStatusBar
        startedAt="not-a-date"
        label="Live"
        detailsTemplate="{duration}"
        connectingLabel="Conectando..."
      />,
    );

    expect(screen.getByText("Conectando...")).toBeTruthy();
  });
});
