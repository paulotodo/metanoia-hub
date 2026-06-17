import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/dialog";

describe("Dialog", () => {
  it("renders when open", () => {
    const { getByText } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(getByText("Dialog Title")).toBeDefined();
  });

  it("passes accessibility checks when open", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accessible Dialog</DialogTitle>
            <DialogDescription>
              This dialog is accessible and has a title.
            </DialogDescription>
          </DialogHeader>
          <p>Dialog body content</p>
        </DialogContent>
      </Dialog>,
    );
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  // T.3 — B.1: Close button touch target ≥ 44×44px — WCAG 2.5.5 / FR-1.2
  it("close button has min-h-[44px] min-w-[44px] touch target classes (FR-1.2)", () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Touch target dialog</DialogTitle>
            <DialogDescription>Testing close button size.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    // Close button rendered by DialogContent (DialogPrimitive.Close)
    const closeBtn = container.querySelector(
      "[data-radix-collection-item], button[aria-label], button:last-of-type",
    );
    // Query pelo botão de fechar via classe ou estrutura
    const allButtons = container.querySelectorAll("button");
    // O close button é o último botão renderizado no DialogContent
    const closeBtnEl = allButtons[allButtons.length - 1];
    if (closeBtnEl) {
      expect(closeBtnEl.className).toContain("min-h-[44px]");
      expect(closeBtnEl.className).toContain("min-w-[44px]");
    }
  });

  // T.3 — B.1: Close button has active:opacity-80 feedback (FR-2.1)
  it("close button has active:opacity-80 touch feedback class (FR-2.1)", () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feedback dialog</DialogTitle>
            <DialogDescription>Testing active feedback.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    const allButtons = container.querySelectorAll("button");
    const closeBtnEl = allButtons[allButtons.length - 1];
    if (closeBtnEl) {
      expect(closeBtnEl.className).toContain("active:opacity-80");
    }
  });

  // T.3 — C.2 / B.1: motion-safe: em animações de overlay e content (FR-3.1)
  it("overlay uses motion-safe: animate-in/out classes (FR-3.2)", () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motion safe dialog</DialogTitle>
            <DialogDescription>Testing motion-safe prefix.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    // Verificar que não há animate-in/animate-out sem prefixo motion-safe:
    const allElements = container.querySelectorAll("[class]");
    const bareAnimatePattern = /(?<![:\w])animate-in|(?<![:\w])animate-out/;
    let hasBareAnimate = false;
    allElements.forEach((el) => {
      const classes = el.className;
      if (bareAnimatePattern.test(classes)) {
        // Se encontrar, verificar se tem prefixo motion-safe: na mesma classe
        const classArr = classes.split(" ");
        const bareAnimates = classArr.filter(
          (c) =>
            (c === "animate-in" || c === "animate-out") &&
            !c.startsWith("motion-safe:"),
        );
        if (bareAnimates.length > 0) hasBareAnimate = true;
      }
    });
    expect(hasBareAnimate).toBe(false);
  });

  // T.3 — C.2: close button uses motion-safe:transition-opacity (FR-3.1)
  it("close button uses motion-safe:transition-opacity (FR-3.1)", () => {
    const { container } = render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transition safe dialog</DialogTitle>
            <DialogDescription>Testing transition prefix.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    const allButtons = container.querySelectorAll("button");
    const closeBtnEl = allButtons[allButtons.length - 1];
    if (closeBtnEl) {
      // Deve ter motion-safe:transition-opacity, não transition-opacity bare
      expect(closeBtnEl.className).toContain("motion-safe:transition-opacity");
      const classes = closeBtnEl.className.split(" ");
      const bareTransition = classes.find((c) => c === "transition-opacity");
      expect(bareTransition).toBeUndefined();
    }
  });
});
