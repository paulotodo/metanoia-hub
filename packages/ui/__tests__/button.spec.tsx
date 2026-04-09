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
});
