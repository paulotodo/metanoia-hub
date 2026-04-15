import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationView } from "../confirmation-view";

describe("ConfirmationView", () => {
  it("renders heading, body and action button", () => {
    render(
      <ConfirmationView
        heading="Guardado."
        body="Sua reflexão foi registrada."
        actionLabel="Voltar ao radar"
        onAction={() => {}}
      />,
    );
    expect(screen.getByText("Guardado.")).toBeTruthy();
    expect(screen.getByText("Sua reflexão foi registrada.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voltar ao radar" })).toBeTruthy();
  });

  it("calls onAction when the button is pressed", () => {
    const onAction = vi.fn();
    render(
      <ConfirmationView
        heading="Tudo bem."
        body="Você pode voltar quando quiser."
        actionLabel="Voltar ao radar"
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao radar" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
