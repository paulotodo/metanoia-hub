import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TermsCheckbox } from "../terms-checkbox";

describe("TermsCheckbox", () => {
  it("calls onCheckedChange with the new value", () => {
    const onCheckedChange = vi.fn();
    render(
      <TermsCheckbox
        id="terms"
        checked={false}
        onCheckedChange={onCheckedChange}
        label="Li e aceito os termos"
      />,
    );

    fireEvent.click(screen.getByLabelText("Li e aceito os termos"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("renders disabled when the prop is set", () => {
    render(
      <TermsCheckbox
        id="terms"
        checked
        disabled
        onCheckedChange={() => {}}
        label="Aceito"
      />,
    );

    const input = screen.getByLabelText("Aceito") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
