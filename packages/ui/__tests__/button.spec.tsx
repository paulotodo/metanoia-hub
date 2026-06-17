import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Button } from "../components/button";

describe("Button", () => {
  it("renders with text", () => {
    const { getByRole } = render(<Button>Click me</Button>);
    expect(getByRole("button").textContent).toBe("Click me");
  });

  it("passes accessibility checks", async () => {
    const { container } = render(<Button>Accessible Button</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("passes accessibility checks for all variants", async () => {
    const variants = [
      "default",
      "destructive",
      "outline",
      "secondary",
      "ghost",
      "link",
    ] as const;

    for (const variant of variants) {
      const { container } = render(
        <Button variant={variant}>{variant} button</Button>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it("passes accessibility checks when disabled", async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // T.3 — A.2: Touch sizing — WCAG 2.5.5 / NFR-A2 / dec-008
  it("size:icon has mobile touch target class (h-11 w-11)", () => {
    const { getByRole } = render(<Button size="icon" aria-label="icon action">X</Button>);
    const btn = getByRole("button");
    // h-11 = 44px mobile; md:h-9 = 36px desktop (dec-008 hibrido)
    expect(btn.className).toContain("h-11");
    expect(btn.className).toContain("w-11");
  });

  it("size:default has mobile touch target class (h-11)", () => {
    const { getByRole } = render(<Button>Default</Button>);
    const btn = getByRole("button");
    // h-11 mobile / md:h-10 desktop
    expect(btn.className).toContain("h-11");
  });

  it("size:sm has mobile min-h-[44px] class", () => {
    const { getByRole } = render(<Button size="sm">Small</Button>);
    const btn = getByRole("button");
    expect(btn.className).toContain("min-h-[44px]");
  });

  it("base has active: feedback classes (active:scale + active:opacity)", () => {
    const { getByRole } = render(<Button>Feedback</Button>);
    const btn = getByRole("button");
    expect(btn.className).toContain("active:scale-[0.98]");
    expect(btn.className).toContain("active:opacity-90");
  });

  it("base uses motion-safe:transition-colors (FR-3.1)", () => {
    const { getByRole } = render(<Button>Motion safe</Button>);
    const btn = getByRole("button");
    expect(btn.className).toContain("motion-safe:transition-colors");
    // Deve NAO conter transition-colors sem prefixo motion-safe
    // (removemos o transition-colors bare da cva base)
    const classes = btn.className.split(" ");
    const bareTransition = classes.find(
      (c) => c === "transition-colors"
    );
    expect(bareTransition).toBeUndefined();
  });
});
