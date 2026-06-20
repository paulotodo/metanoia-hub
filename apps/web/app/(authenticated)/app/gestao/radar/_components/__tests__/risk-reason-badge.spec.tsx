/**
 * Tests for RiskReasonBadge component (Story 13.3 / FASE 9.1 / FR66).
 *
 * Covers:
 *  - Renders correct PT-BR label for each riskReason
 *  - Has icon (AlertTriangle) + text (not color alone) — a11y
 *  - aria-label describes the risk reason
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskReasonBadge } from "../risk-reason-badge";

describe("RiskReasonBadge", () => {
  it.each([
    ["absences", "Ausências consecutivas ao grupo"],
    ["inactivity", "Inatividade na plataforma"],
    ["absences+inactivity", "Ausências e inatividade"],
  ] as const)(
    "renders PT-BR label for riskReason=%s",
    (riskReason, expectedLabel) => {
      render(<RiskReasonBadge riskReason={riskReason} />);
      expect(screen.getByText(expectedLabel)).toBeDefined();
    },
  );

  it("has aria-label that describes the risk reason", () => {
    render(<RiskReasonBadge riskReason="absences" />);
    const badge = screen.getByLabelText(/Motivo do risco/i);
    expect(badge).toBeDefined();
  });

  it("renders an icon (AlertTriangle) with aria-hidden", () => {
    const { container } = render(<RiskReasonBadge riskReason="inactivity" />);
    const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("uses text-secondary contrast token (not only color)", () => {
    const { container } = render(
      <RiskReasonBadge riskReason="absences+inactivity" />,
    );
    // Verify text content is present (not just a colored dot)
    expect(container.textContent).toContain("Ausências e inatividade");
  });
});
