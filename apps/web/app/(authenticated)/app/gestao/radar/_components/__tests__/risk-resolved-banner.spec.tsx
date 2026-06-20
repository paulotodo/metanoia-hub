/**
 * Tests for RiskResolvedBanner component (Story 13.3 / FASE 9.2 / FR66).
 *
 * Covers:
 *  - Renders participant name in message ("{Nome} voltou a participar!")
 *  - Has role="status" and aria-live="polite" for screen readers
 *  - Dismiss button works
 *  - RiskResolvedBannerList renders multiple items and limits to max
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  RiskResolvedBanner,
  RiskResolvedBannerList,
} from "../risk-resolved-banner";

const mockItem = {
  id: "01912345-6789-7000-8000-0000000000aa",
  participantName: "Maria Silva",
  resolvedAt: new Date().toISOString(),
};

describe("RiskResolvedBanner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders participant name in pastoral message", () => {
    const onDismiss = vi.fn();
    render(<RiskResolvedBanner item={mockItem} onDismiss={onDismiss} />);
    expect(screen.getByText(/Maria Silva voltou a participar!/i)).toBeDefined();
  });

  it("has role=status and aria-live=polite for screen readers", () => {
    const { container } = render(
      <RiskResolvedBanner item={mockItem} onDismiss={vi.fn()} />,
    );
    const banner = container.querySelector('[role="status"]');
    expect(banner).toBeDefined();
    expect(banner?.getAttribute("aria-live")).toBe("polite");
    expect(banner?.getAttribute("aria-atomic")).toBe("true");
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<RiskResolvedBanner item={mockItem} onDismiss={onDismiss} />);
    const btn = screen.getByRole("button", { name: /Dispensar/i });
    fireEvent.click(btn);
    expect(onDismiss).toHaveBeenCalledWith(mockItem.id);
  });

  it("auto-dismisses after 10 seconds", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<RiskResolvedBanner item={mockItem} onDismiss={onDismiss} />);
    await act(async () => {
      vi.advanceTimersByTime(10_001);
    });
    expect(onDismiss).toHaveBeenCalledWith(mockItem.id);
  });

  it("does not show banner after dismiss", () => {
    const onDismiss = vi.fn();
    render(<RiskResolvedBanner item={mockItem} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /Dispensar/i }));
    expect(screen.queryByTestId("risk-resolved-banner")).toBeNull();
  });
});

describe("RiskResolvedBannerList", () => {
  const items = [
    { id: "1", participantName: "João", resolvedAt: new Date().toISOString() },
    { id: "2", participantName: "Ana", resolvedAt: new Date().toISOString() },
    { id: "3", participantName: "Pedro", resolvedAt: new Date().toISOString() },
    { id: "4", participantName: "Paula", resolvedAt: new Date().toISOString() },
  ];

  it("renders up to limit (default 3) banners", () => {
    render(<RiskResolvedBannerList items={items} />);
    const banners = screen.getAllByTestId("risk-resolved-banner");
    expect(banners.length).toBe(3);
  });

  it("respects custom limit prop", () => {
    render(<RiskResolvedBannerList items={items} limit={2} />);
    const banners = screen.getAllByTestId("risk-resolved-banner");
    expect(banners.length).toBe(2);
  });

  it("returns null when all items are dismissed", () => {
    const { container } = render(
      <RiskResolvedBannerList items={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
