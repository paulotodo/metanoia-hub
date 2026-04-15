import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ReflectionFormField } from "../reflection-form-field";

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <ReflectionFormField
      label="O que vale lembrar?"
      counterTemplate="{remaining} caracteres"
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      autoFocus
    />
  );
}

describe("ReflectionFormField", () => {
  it("renders label and starts at 280 remaining", () => {
    render(<Harness />);
    expect(screen.getByText("O que vale lembrar?")).toBeTruthy();
    expect(screen.getByTestId("reflection-counter").textContent).toBe(
      "280 caracteres",
    );
  });

  it("counter decrements as user types", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Pedro precisa de oração" } });
    expect(screen.getByTestId("reflection-counter").textContent).toBe(
      "257 caracteres",
    );
  });

  it("caps input at 280 via maxLength", () => {
    render(<Harness initial={"a".repeat(280)} />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(input.maxLength).toBe(280);
    expect(screen.getByTestId("reflection-counter").textContent).toBe(
      "0 caracteres",
    );
  });

  it("auto-focuses on mount when autoFocus is set", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox");
    expect(document.activeElement).toBe(input);
  });
});
