import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EndConfirmDialog } from "../end-confirm-dialog";

const baseProps = {
  title: "Encerrar a sala?",
  body: "Todos serão desconectados e você vai para a reflexão.",
  confirmLabel: "Encerrar",
  cancelLabel: "Cancelar",
};

describe("EndConfirmDialog", () => {
  it("is not visible when open is false", () => {
    render(
      <EndConfirmDialog
        {...baseProps}
        open={false}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText("Encerrar a sala?")).toBeNull();
  });

  it("renders title, body and both buttons when open", () => {
    render(
      <EndConfirmDialog
        {...baseProps}
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Encerrar a sala?")).toBeTruthy();
    expect(
      screen.getByText(
        "Todos serão desconectados e você vai para a reflexão.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Encerrar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });

  it("calls onConfirm when the end button is pressed", () => {
    const onConfirm = vi.fn();
    render(
      <EndConfirmDialog
        {...baseProps}
        open
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange(false) when cancel is pressed", () => {
    const onOpenChange = vi.fn();
    render(
      <EndConfirmDialog
        {...baseProps}
        open
        onOpenChange={onOpenChange}
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows pending label on end button when pending", () => {
    render(
      <EndConfirmDialog
        {...baseProps}
        open
        onOpenChange={() => {}}
        onConfirm={() => {}}
        pending
        pendingLabel="Encerrando..."
      />,
    );
    expect(screen.getByRole("button", { name: "Encerrando..." })).toBeTruthy();
  });
});
