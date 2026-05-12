import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransparencyBanner } from "../transparency-banner";

describe("TransparencyBanner", () => {
  it("renders the base pastoral message in PT-BR", () => {
    render(<TransparencyBanner focusIndicatorEnabled={false} />);
    expect(
      screen.getByText(/Sinais de presença e engajamento/i),
    ).toBeTruthy();
  });

  it("omits the focus disclosure when toggle is OFF (NFR-L4 privacy default)", () => {
    render(<TransparencyBanner focusIndicatorEnabled={false} />);
    expect(screen.queryByTestId("transparency-banner-focus")).toBeNull();
  });

  it("adds the focus disclosure when toggle is ON", () => {
    render(<TransparencyBanner focusIndicatorEnabled={true} />);
    expect(screen.getByTestId("transparency-banner-focus")).toBeTruthy();
    expect(
      screen.getByText(/indicador de foco de aba/i),
    ).toBeTruthy();
  });

  it("renders role=status with aria-live polite for accessibility", () => {
    render(<TransparencyBanner focusIndicatorEnabled={false} />);
    const el = screen.getByTestId("transparency-banner");
    expect(el.getAttribute("role")).toBe("status");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });
});
