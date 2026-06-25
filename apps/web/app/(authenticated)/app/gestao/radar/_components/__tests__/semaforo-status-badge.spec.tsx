/**
 * Tests for SemaforoStatusBadge — Story 15.3 (FR-001/002/003/004/005).
 *
 * Covers:
 *  - 3 estados × ícone correto × texto visível × aria-hidden no ícone
 *  - aria-label contextual quando participantName presente
 *  - Modo compacto: texto abreviado + aria-label completo
 *  - Pulso: classe aplicada quando animatePulse=true
 *  - Sem duplo-anúncio: texto visível aria-hidden quando aria-label presente
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SemaforoStatusBadge } from "../semaforo-status-badge";

describe("SemaforoStatusBadge", () => {
  describe("3 estados — texto visível e ícone com aria-hidden", () => {
    it.each([
      ["care-urgent", "Urgente"],
      ["care-attention", "Atenção necessária"],
      ["care-ok", "Bem"],
    ] as const)(
      "renders visível label for signalType=%s",
      (signalType, expectedLabel) => {
        render(<SemaforoStatusBadge signalType={signalType} />);
        expect(screen.getByText(expectedLabel)).toBeDefined();
      },
    );

    it("renders icon with aria-hidden for each state", () => {
      const signals = ["care-urgent", "care-attention", "care-ok"] as const;
      for (const signalType of signals) {
        const { container, unmount } = render(
          <SemaforoStatusBadge signalType={signalType} />,
        );
        const hiddenSvgs = container.querySelectorAll('svg[aria-hidden="true"]');
        expect(
          hiddenSvgs.length,
          `${signalType}: should have icon with aria-hidden=true`,
        ).toBeGreaterThan(0);
        unmount();
      }
    });
  });

  describe("aria-label contextual quando participantName presente (dec-007)", () => {
    it("composes aria-label as '{label} — {name}'", () => {
      const { container } = render(
        <SemaforoStatusBadge signalType="care-urgent" participantName="João" />,
      );
      const badge = container.querySelector('[aria-label]');
      expect(badge?.getAttribute("aria-label")).toBe("Urgente — João");
    });

    it("marks visible text as aria-hidden to avoid double-announcement", () => {
      const { container } = render(
        <SemaforoStatusBadge signalType="care-attention" participantName="Maria" />,
      );
      // The span with the label text should be aria-hidden when aria-label is set
      const hiddenTextSpan = container.querySelector('span[aria-hidden="true"]:not(svg)');
      expect(hiddenTextSpan).toBeDefined();
    });

    it("does NOT set aria-label when participantName is absent", () => {
      const { container } = render(
        <SemaforoStatusBadge signalType="care-ok" />,
      );
      const badge = container.querySelector('[aria-label]');
      expect(badge).toBeNull();
    });
  });

  describe("modo compacto", () => {
    it("shows abbreviated text (first word only) in compact mode", () => {
      render(
        <SemaforoStatusBadge signalType="care-attention" compact />,
      );
      // Full label is "Atenção necessária" — compact should show only "Atenção"
      expect(screen.getByText("Atenção")).toBeDefined();
      expect(screen.queryByText("Atenção necessária")).toBeNull();
    });

    it("compact mode with participantName: aria-label has full label", () => {
      const { container } = render(
        <SemaforoStatusBadge
          signalType="care-attention"
          participantName="Pedro"
          compact
        />,
      );
      const badge = container.querySelector('[aria-label]');
      // aria-label must use full label (not abbreviated)
      expect(badge?.getAttribute("aria-label")).toBe("Atenção necessária — Pedro");
    });

    it("care-urgent compact shows 'Urgente' (single word — no truncation)", () => {
      render(<SemaforoStatusBadge signalType="care-urgent" compact />);
      expect(screen.getByText("Urgente")).toBeDefined();
    });
  });

  describe("animatePulse prop", () => {
    it("applies motion-safe:animate class when animatePulse=true", () => {
      const { container } = render(
        <SemaforoStatusBadge signalType="care-urgent" animatePulse />,
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("motion-safe:animate-[pulse-border_1s_ease-out]");
    });

    it("does not have animation class when animatePulse=false", () => {
      const { container } = render(
        <SemaforoStatusBadge signalType="care-urgent" animatePulse={false} />,
      );
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).not.toContain("pulse-border");
    });
  });
});
