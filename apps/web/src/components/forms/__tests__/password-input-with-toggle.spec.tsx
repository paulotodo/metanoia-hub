import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordInputWithToggle } from "../password-input-with-toggle";

describe("PasswordInputWithToggle", () => {
  it("starts hidden and toggles visibility on click", () => {
    render(
      <PasswordInputWithToggle
        aria-label="Senha"
        toggleShowLabel="Mostrar senha"
        toggleHideLabel="Ocultar senha"
      />,
    );

    const input = screen.getByLabelText("Senha");
    expect(input.getAttribute("type")).toBe("password");

    const toggle = screen.getByRole("button", { name: "Mostrar senha" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);

    expect(input.getAttribute("type")).toBe("text");
    expect(
      screen
        .getByRole("button", { name: "Ocultar senha" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("forwards value changes via the standard onChange", () => {
    let currentValue = "";
    render(
      <PasswordInputWithToggle
        aria-label="Senha"
        toggleShowLabel="Mostrar"
        toggleHideLabel="Ocultar"
        onChange={(e) => {
          currentValue = e.target.value;
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "abc12345" },
    });
    expect(currentValue).toBe("abc12345");
  });
});
