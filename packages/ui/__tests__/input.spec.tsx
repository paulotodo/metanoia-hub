import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";
import { Input } from "../components/input";

describe("Input", () => {
  it("renders with placeholder", () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Enter text" />,
    );
    expect(getByPlaceholderText("Enter text")).toBeDefined();
  });

  it("passes accessibility checks with label", async () => {
    const { container } = render(
      <div>
        <label htmlFor="email">Email</label>
        <Input id="email" type="email" placeholder="nome@exemplo.com" />
      </div>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("passes accessibility checks with aria-label", async () => {
    const { container } = render(
      <Input aria-label="Search" type="search" placeholder="Buscar..." />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("passes accessibility checks when disabled", async () => {
    const { container } = render(
      <div>
        <label htmlFor="disabled-input">Disabled field</label>
        <Input id="disabled-input" disabled />
      </div>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // T.3 — A.4: Touch target height — WCAG 2.5.5 / NFR-A2 / FR-1.1
  it("has h-11 mobile touch target class (44px)", () => {
    const { container } = render(
      <Input aria-label="Touch target test" />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    // h-11 = 44px mobile; md:h-10 = 40px desktop (dec-008 híbrido)
    expect(input!.className).toContain("h-11");
    expect(input!.className).toContain("md:h-10");
  });

  // T.3 — C.2: Sem transition-* bare (motion-safe irrelevante p/ Input — sem animação)
  // Verificar que Input não introduz transition-* não-guardado
  it("does not contain bare transition-* classes (FR-3.1 motion-safe contract)", () => {
    const { container } = render(
      <Input aria-label="Motion contract" />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    const classes = input!.className.split(" ");
    const bareTransitions = classes.filter(
      (c) =>
        (c === "transition-colors" ||
          c === "transition-opacity" ||
          c === "transition-all" ||
          c === "transition-transform") &&
        !c.startsWith("motion-safe:"),
    );
    // Input não tem transition nenhuma bare (sem animação de entrada/saída)
    expect(bareTransitions).toHaveLength(0);
  });
});
