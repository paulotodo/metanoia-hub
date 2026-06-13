import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoOverlay } from "../demo-overlay";

describe("DemoOverlay", () => {
  it("renders the overlayBadge text", () => {
    render(
      <DemoOverlay>
        <p>demo content</p>
      </DemoOverlay>,
    );
    expect(screen.getByText("Dados de exemplo")).toBeTruthy();
  });

  it("renders children inside the overlay", () => {
    render(
      <DemoOverlay>
        <p data-testid="child">hello</p>
      </DemoOverlay>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("badge has aria-label describing demo nature", () => {
    render(
      <DemoOverlay>
        <span />
      </DemoOverlay>,
    );
    const badge = screen.getByLabelText(
      "Este conteudo e um exemplo — nao representa sua congregacao real",
    );
    expect(badge).toBeTruthy();
  });

  it("wrapper has dashed border class for visual signal", () => {
    const { container } = render(
      <DemoOverlay>
        <span />
      </DemoOverlay>,
    );
    const wrapper = container.querySelector(".border-dashed");
    expect(wrapper).not.toBeNull();
  });
});
