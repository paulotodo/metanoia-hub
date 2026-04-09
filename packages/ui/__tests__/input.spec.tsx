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
});
