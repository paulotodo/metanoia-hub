/**
 * delete-group-dialog.spec.tsx — Testes unitários: DeleteGroupDialog
 *
 * Story 12.2 — US3, FR-009, CL-002
 *
 * Cobre:
 *   - Renderização condicional (open=true/false)
 *   - Nome do grupo exibido na descrição
 *   - Botão Cancelar fecha o diálogo (onOpenChange(false))
 *   - Botão Confirmar chama onConfirm
 *   - Estado pending desabilita botões
 *   - jest-axe: sem violações de acessibilidade no diálogo aberto
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "jest-axe";
import { DeleteGroupDialog } from "../delete-group-dialog";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RenderDialogOptions {
  open?: boolean;
  groupName?: string;
  onOpenChange?: ReturnType<typeof vi.fn>;
  onConfirm?: ReturnType<typeof vi.fn>;
  pending?: boolean;
}

function renderDialog({
  open = true,
  groupName = "Célula Quinta à Noite",
  onOpenChange = vi.fn(),
  onConfirm = vi.fn(),
  pending = false,
}: RenderDialogOptions = {}) {
  render(
    <DeleteGroupDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      groupName={groupName}
      pending={pending}
    />,
  );
  return { onOpenChange, onConfirm };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe("DeleteGroupDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza o diálogo quando open=true", () => {
    renderDialog({ open: true });
    expect(screen.getByTestId("delete-group-dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Excluir grupo" })).toBeTruthy();
  });

  it("não renderiza conteúdo quando open=false", () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId("delete-group-dialog")).toBeNull();
  });

  it("exibe o nome do grupo na mensagem de confirmação", () => {
    renderDialog({ groupName: "Grupo Alfa" });
    expect(screen.getByText(/Grupo Alfa/)).toBeTruthy();
  });

  it("chama onOpenChange(false) ao clicar em Cancelar", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByTestId("delete-group-cancel"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("chama onConfirm ao clicar em Excluir grupo", () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByTestId("delete-group-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("desabilita botões quando pending=true", () => {
    renderDialog({ pending: true });
    const cancelBtn = screen.getByTestId("delete-group-cancel");
    const confirmBtn = screen.getByTestId("delete-group-confirm");
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("exibe texto alternativo quando pending=true", () => {
    renderDialog({ pending: true });
    expect(screen.getByText("Excluindo...")).toBeTruthy();
  });

  it("jest-axe: sem violações de acessibilidade no diálogo aberto", async () => {
    const { container } = render(
      <DeleteGroupDialog
        open={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        groupName="Grupo Teste"
      />,
    );
    const results = await act(async () => axe(container));
    expect(results).toHaveNoViolations();
  });
});
